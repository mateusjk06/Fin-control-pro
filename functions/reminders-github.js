"use strict";

/**
 * GitHub Actions runner. Never put API tokens or Google credentials in this file.
 * Only users who explicitly opted in receive WhatsApp notifications.
 */
const admin = require("firebase-admin");

function brazilDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const get = key => parts.find(part => part.type === key)?.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}

function addMonths(iso, offset) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + offset, 1, 12));
  if (!Number.isFinite(base.getTime())) return "";
  const maxDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  return base.getUTCFullYear() + "-" + String(base.getUTCMonth() + 1).padStart(2, "0") + "-" + String(Math.min(d, maxDay)).padStart(2, "0");
}

function entriesDue(data, today) {
  const results = [];
  (Array.isArray(data.bills) ? data.bills : []).forEach((bill, index) => {
    if (!bill || bill.paid || String(bill.date || "").slice(0, 10) !== today) return;
    results.push({key: "bill:" + (bill.id ?? index), kind: "Conta", title: String(bill.desc || "Conta"), amount: Number(bill.val) || 0});
  });
  (Array.isArray(data.debts) ? data.debts : []).forEach((debt, debtIndex) => {
    if (!debt || !(Number(debt.balance) > 0)) return;
    const schedule = Array.isArray(debt.schedule) ? debt.schedule : [];
    const firstPendingIndex = schedule.findIndex(p => p && !p.paid);
    if (firstPendingIndex < 0) return;
    schedule.forEach((payment, index) => {
      if (!payment || payment.paid) return;
      const due = debt.nextDueDate
        ? addMonths(debt.nextDueDate, index - firstPendingIndex)
        : String(payment.date || "").slice(0, 10);
      if (due !== today) return;
      results.push({
        key: "debt:" + (debt.id ?? debtIndex) + ":" + index,
        kind: "Dívida",
        title: String(debt.desc || "Dívida"),
        amount: Number(payment.value ?? debt.minPayment) || 0
      });
    });
  });
  return results;
}

function summary(entries, currency) {
  const cur = /^[A-Z]{3}$/.test(currency || "") ? currency : "BRL";
  let money;
  try { money = new Intl.NumberFormat("pt-BR", {style: "currency", currency: cur}); }
  catch { money = new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"}); }
  const text = entries.slice(0, 8).map(x => x.kind + ": " + x.title.slice(0, 75) + " (" + money.format(x.amount) + ")").join("; ");
  return (text + (entries.length > 8 ? "; mais " + (entries.length - 8) + " vencimento(s)" : "")).slice(0, 950);
}

async function sendTemplate(to, detail) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.META_GRAPH_VERSION || "v23.0";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "fincontrol_vencimento_hoje";
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR";
  const response = await fetch("https://graph.facebook.com/" + version + "/" + encodeURIComponent(id) + "/messages", {
    method: "POST",
    headers: {Authorization: "Bearer " + token, "Content-Type": "application/json"},
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: {
        name: templateName,
        language: {code: templateLanguage},
        components: [{type: "body", parameters: [{type: "text", text: detail}]}]
      }
    }),
    signal: AbortSignal.timeout(25000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.messages?.[0]?.id) {
    throw Error("WhatsApp API error HTTP " + response.status + " code " + (payload.error?.code || "unknown"));
  }
  return payload.messages[0].id;
}

async function main() {
  const required = ["FIREBASE_SERVICE_ACCOUNT_JSON", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw Error("Missing GitHub Actions secrets: " + missing.join(", "));
  let serviceAccount;
  try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
  catch { throw Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."); }
  if (serviceAccount.project_id !== "fincontrol-pro-6cc5d") throw Error("Firebase service account is not for fincontrol-pro-6cc5d.");
  admin.initializeApp({credential: admin.credential.cert(serviceAccount)});
  const db = admin.firestore();
  const today = brazilDay();
  const users = await db.collection("users").listDocuments();
  let accepted = 0, failed = 0, eligible = 0;
  const preview = process.env.REMINDERS_DRY_RUN === "true";
  for (const userRef of users) {
    const document = await userRef.collection("appData").doc("main").get();
    if (!document.exists) continue;
    const data = document.data() || {};
    const prefs = data.contactPreferences || {};
    if (prefs.whatsappOptIn !== true || prefs.reminders === false) continue;
    const to = String(prefs.whatsapp || "").replace(/\D/g, "");
    if (!/^[1-9]\d{7,14}$/.test(to)) continue;
    const due = entriesDue(data, today);
    if (!due.length) continue;
    eligible++;
    if (preview) {
      console.log("Dry run: eligible account with " + due.length + " due item(s). No message sent.");
      continue;
    }
    const logRef = userRef.collection("notificationLogs").doc("whatsapp_" + today);
    const claim = await db.runTransaction(async tx => {
      const existing = await tx.get(logRef);
      const value = existing.data() || {};
      const ms = Date.now();
      if (value.status === "sent" || value.status === "sending") return false;
      tx.set(logRef, {
        status: "sending", startedAtMs: ms, count: due.length,
        keys: due.map(item => item.key), updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      return true;
    });
    if (!claim) continue;
    try {
      const messageId = await sendTemplate(to, summary(due, data.currency));
      await logRef.set({status: "sent", messageId, acceptedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
      accepted++;
    } catch (err) {
      failed++;
      await logRef.set({
        status: "error", error: String(err.message).slice(0, 200),
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      console.error("Reminder submission failed for one account: " + String(err.message));
    }
  }
  console.log(JSON.stringify({date: today, eligibleAccounts: eligible, acceptedByMeta: accepted, failed, dryRun: preview}));
  if (failed > 0) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {brazilDay, addMonths, entriesDue, summary};
