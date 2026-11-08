"use strict";
const admin=require("firebase-admin");
const {brazilDay,addMonths,entriesDue,summary}=require("./reminders-github");
async function main(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw Error("Configure FIREBASE_SERVICE_ACCOUNT_JSON nos GitHub Actions secrets.");
  const account=JSON.parse(raw);
  if(account.project_id!=="fincontrol-pro-6cc5d")throw Error("Conta de serviço pertence a outro projeto.");
  admin.initializeApp({credential:admin.credential.cert(account)});
  const db=admin.firestore(),today=brazilDay();
  const users=await db.collection("users").listDocuments();
  const dry=process.env.PUSH_DRY_RUN==="true";
  let eligible=0,accepted=0,errors=0;
  for(const user of users){
    const ref=user.collection("appData").doc("main");
    const snap=await ref.get();
    if(!snap.exists)continue;
    const data=snap.data()||{};
    if(data.contactPreferences?.reminders===false||data.contactPreferences?.pushOptIn!==true)continue;
    const tokens=[...new Set((Array.isArray(data.pushTokens)?data.pushTokens:[]).filter(x=>typeof x==="string"&&x.length>20))].slice(0,10);
    if(!tokens.length)continue;
    const due=entriesDue(data,today);
    if(!due.length)continue;
    eligible++;
    if(dry){console.log("Teste: conta habilitada com "+due.length+" vencimento(s) e "+tokens.length+" dispositivo(s).");continue;}
    const log=user.collection("notificationLogs").doc("push_"+today);
    const allowed=await db.runTransaction(async tx=>{
      const prev=(await tx.get(log)).data()||{};
      if(prev.status==="sent"||prev.status==="sending")return false;
      tx.set(log,{status:"sending",startedAt:admin.firestore.FieldValue.serverTimestamp(),count:due.length},{merge:true});
      return true;
    });
    if(!allowed)continue;
    try{
      const heading=due.length===1?"1 vencimento hoje":"Você tem "+due.length+" vencimentos hoje";
      const detail=summary(due,data.currency).slice(0,900);
      const response=await admin.messaging().sendEachForMulticast({
        tokens,
        data:{title:"FinControl Pro — "+heading,body:detail,url:"./"},
        webpush:{headers:{TTL:"43200"}}
      });
      const invalid=[];
      response.responses.forEach((entry,i)=>{
        if(!entry.success&&["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(entry.error?.code))invalid.push(tokens[i]);
      });
      if(invalid.length){
        // Update only the array field to avoid clobbering financial records.
        await ref.update({pushTokens:admin.firestore.FieldValue.arrayRemove(...invalid)});
      }
      if(!response.successCount)throw Error("Nenhum dispositivo aceitou a notificação.");
      await log.set({status:"sent",accepted:response.successCount,failed:response.failureCount,completedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      accepted+=response.successCount;
    }catch(e){
      errors++;await log.set({status:"error",message:String(e.message).slice(0,150)},{merge:true});
      console.error("Falha de envio para um usuário:",e.message);
    }
  }
  console.log(JSON.stringify({day:today,eligible,accepted,errors,dryRun:dry}));
  if(errors)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
