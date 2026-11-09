"use strict";
const admin=require("firebase-admin");
const {onSchedule}=require("firebase-functions/v2/scheduler");
const {defineSecret}=require("firebase-functions/params");
admin.initializeApp();
const db=admin.firestore();
const token=defineSecret("WHATSAPP_ACCESS_TOKEN");
const phoneId=defineSecret("WHATSAPP_PHONE_NUMBER_ID");
function todayBR(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function addMonths(value,offset){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return "";
 const [y,m,d]=value.split("-").map(Number);
 const date=new Date(Date.UTC(y,m-1+offset,1,12));
 const max=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
 return [date.getUTCFullYear(),String(date.getUTCMonth()+1).padStart(2,"0"),String(Math.min(d,max)).padStart(2,"0")].join("-");
}
function dueItems(data,today){
 const items=[];
 for(const b of Array.isArray(data.bills)?data.bills:[]){
  if(b&&!b.paid&&b.date===today)items.push({name:String(b.desc||"Conta").slice(0,80),amount:Number(b.val)||0,type:"Conta"});
 }
 for(const d of Array.isArray(data.debts)?data.debts:[]){
  if(!d||!(Number(d.balance)>0))continue;
  const schedule=Array.isArray(d.schedule)?d.schedule:[];
  const first=schedule.findIndex(p=>p&&!p.paid);
  if(first<0)continue;
  schedule.forEach((p,i)=>{
   if(!p||p.paid)return;
   const date=d.nextDueDate?addMonths(d.nextDueDate,i-first):p.date;
   if(date===today)items.push({name:String(d.desc||"Dívida").slice(0,80),amount:Number(p.value??d.minPayment)||0,type:"Dívida"});
  });
 }
 return items;
}
async function send(to,summary){
 const response=await fetch("https://graph.facebook.com/v23.0/"+phoneId.value()+"/messages",{
  method:"POST",
  headers:{Authorization:"Bearer "+token.value(),"Content-Type":"application/json"},
  body:JSON.stringify({messaging_product:"whatsapp",to,type:"template",
   template:{name:"fincontrol_vencimento_hoje",language:{code:"pt_BR"},
    components:[{type:"body",parameters:[{type:"text",text:summary}]}]}})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.messages?.[0]?.id)throw Error("Meta rejected request: "+response.status+" "+(result.error?.code||""));
 return result.messages[0].id;
}
exports.sendDueWhatsAppReminders=onSchedule({
 schedule:"0 9 * * *",timeZone:"America/Sao_Paulo",region:"southamerica-east1",
 secrets:[token,phoneId],maxInstances:1,timeoutSeconds:540
},async()=>{
 const today=todayBR();
 // Firebase project structure: users/{uid}/appData/main.
 const users=await db.collection("users").listDocuments();
 for(const userRef of users){
  const snap=await userRef.collection("appData").doc("main").get();
  if(!snap.exists)continue;
  const data=snap.data()||{}, prefs=data.contactPreferences||{};
  if(prefs.whatsappOptIn!==true||prefs.reminders===false)continue;
  const phone=String(prefs.whatsapp||"").replace(/\D/g,"");
  if(!/^[1-9]\d{7,14}$/.test(phone))continue;
  const items=dueItems(data,today);
  if(!items.length)continue;
  const logRef=userRef.collection("notificationLogs").doc("whatsapp_"+today);
  const acquired=await db.runTransaction(async tx=>{
   const snap=await tx.get(logRef),v=snap.data()||{},now=Date.now();
   if(v.status==="sent"||(v.status==="sending"&&now-(v.startedAtMs||0)<1200000))return false;
   tx.set(logRef,{status:"sending",startedAtMs:now,count:items.length},{merge:true});return true;
  });
  if(!acquired)continue;
  try{
   const currency=/^[A-Z]{3}$/.test(data.currency||"")?data.currency:"BRL";
   const fmt=new Intl.NumberFormat("pt-BR",{style:"currency",currency});
   const summary=items.slice(0,8).map(x=>x.type+": "+x.name+" ("+fmt.format(x.amount)+")").join("; ").slice(0,950);
   const messageId=await send(phone,summary);
   await logRef.set({status:"sent",messageId,acceptedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  }catch(error){
   await logRef.set({status:"error",error:String(error.message).slice(0,200)},{merge:true});
   console.error("WhatsApp send failed for user",userRef.id,error.message);
  }
 }
});
// Alexa OAuth2 and read-only financial summary endpoint.
exports.alexaOAuth=require('./alexa-oauth').alexaOAuth;
