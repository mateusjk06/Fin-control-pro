"use strict";
// Paste into Alexa-hosted skill lambda/index.js only after OAuth is deployed.
// Read-only initial rollout. All write commands remain intentionally disabled.
const Alexa=require("ask-sdk-core");
const api="https://southamerica-east1-fincontrol-pro-6cc5d.cloudfunctions.net/alexaOAuth?action=summary";
const words={
 "pt-BR":{welcome:"Bem-vindo ao FinControl Pro. Pergunte quais contas estão pendentes ou qual o total de suas dívidas.",link:"Vincule sua conta do FinControl Pro no aplicativo Alexa antes de consultar seus dados.",empty:"Não encontrei dados financeiros nesta conta.",error:"Não consegui acessar seus dados agora. Tente novamente mais tarde.",future:"Esse comando ainda está em preparação. Nenhuma alteração foi feita.",help:"Você pode perguntar sobre contas a vencer e dívidas.",bills:"Você tem {count} contas pendentes, com total de {total}.",debt:"Seu saldo total de dívidas é {total}.",upcoming:"As próximas contas são: {items}.",none:"Não há contas com vencimento cadastrado."},
 "en-US":{welcome:"Welcome to FinControl Pro. Ask about pending bills or your debt total.",link:"Please link your FinControl Pro account in the Alexa app first.",empty:"I could not find financial data for this account.",error:"I could not access your data. Please try later.",future:"That command is not available yet. No changes were made.",help:"You can ask about pending bills and debts.",bills:"You have {count} pending bills totaling {total}.",debt:"Your total outstanding debt is {total}.",upcoming:"Your upcoming bills are: {items}.",none:"There are no bills with due dates."},
 "it-IT":{welcome:"Benvenuto su FinControl Pro. Chiedi quali bollette sono da pagare o quanti debiti hai.",link:"Collega il tuo account FinControl Pro nell'app Alexa prima di continuare.",empty:"Non ho trovato dati finanziari per questo account.",error:"Non riesco ad accedere ai dati adesso. Riprova più tardi.",future:"Questo comando non è ancora disponibile. Nessun dato è stato modificato.",help:"Puoi chiedere delle bollette in sospeso e dei debiti.",bills:"Hai {count} bollette da pagare, per un totale di {total}.",debt:"Il totale dei debiti residui è {total}.",upcoming:"Le prossime bollette sono: {items}.",none:"Non ci sono bollette con scadenza registrata."},
 "es-ES":{welcome:"Bienvenido a FinControl Pro. Pregunta por las facturas pendientes o el total de deudas.",link:"Vincula tu cuenta de FinControl Pro desde la aplicación Alexa para continuar.",empty:"No encontré datos financieros en esta cuenta.",error:"No pude consultar tus datos. Inténtalo más tarde.",future:"Este comando aún no está disponible. No se modificaron tus datos.",help:"Puedes consultar facturas pendientes y deudas.",bills:"Tienes {count} facturas pendientes por un total de {total}.",debt:"El total de tus deudas pendientes es {total}.",upcoming:"Tus próximas facturas son: {items}.",none:"No hay facturas con fechas de vencimiento."}
};
function locale(h){
 const code=h.requestEnvelope.request.locale||"pt-BR";
 return words[code]||words["pt-BR"];
}
function say(h,message,reprompt){
 const b=h.responseBuilder.speak(message);
 if(reprompt)b.reprompt(reprompt);
 return b.getResponse();
}
async function report(h){
 const w=locale(h);
 const token=(((h.requestEnvelope||{}).context||{}).System||{}).user;
 const accessToken=token ? token.accessToken : null;
 if(!accessToken)return h.responseBuilder.speak(w.link).withLinkAccountCard().getResponse();
 let resp;
 try{
  resp=await fetch(api,{headers:{Authorization:"Bearer "+accessToken},signal:AbortSignal.timeout(9000)});
 }catch(e){return say(h,w.error);}
 if(resp.status===401)return h.responseBuilder.speak(w.link).withLinkAccountCard().getResponse();
 if(resp.status===404)return say(h,w.empty);
 if(!resp.ok)return say(h,w.error);
 let d;try{d=await resp.json();}catch{return say(h,w.error);}
 const lang=h.requestEnvelope.request.locale||"pt-BR";
 const currency=/^[A-Z]{3}$/.test(d.currency||"")?d.currency:"BRL";
 const money=n=>new Intl.NumberFormat(lang,{style:"currency",currency}).format(Number(n)||0);
 const intent=Alexa.getIntentName(h.requestEnvelope);
 if(intent==="ConsultarDividasIntent")return say(h,w.debt.replace("{total}",money(d.outstandingDebtTotal)));
 if(intent==="ConsultarContasIntent"){
  const bills=Array.isArray(d.upcomingBills)?d.upcomingBills:[];
  const upcoming=bills.slice(0,3).map(x=>x.title+" "+money(x.amount)).join("; ");
  const text=w.bills.replace("{count}",String(d.pendingBills||0)).replace("{total}",money(d.pendingBillTotal));
  return say(h,text+" "+(upcoming?w.upcoming.replace("{items}",upcoming):w.none));
 }
 return say(h,w.future);
}
const LaunchHandler={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==="LaunchRequest",
 handle:h=>say(h,locale(h).welcome,locale(h).help)
};
const InquiryHandler={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==="IntentRequest"&&
 ["ConsultarContasIntent","ConsultarDividasIntent"].includes(Alexa.getIntentName(h.requestEnvelope)),
 handle:report
};
const UnsupportedHandler={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==="IntentRequest"&&
 ["CadastrarContaIntent","CadastrarReceitaIntent","CadastrarDividaIntent","RegistrarAporteIntent",
 "MarcarContaPagaIntent","AlterarVencimentoIntent","AlterarValorIntent","ExcluirContaIntent",
 "ConsultarSaldoIntent","ConsultarReceitasIntent","ConsultarDespesasIntent",
 "ConsultarInvestimentosIntent","ConsultarAnaliseIntent","ConsultarQuitacaoIntent"].includes(Alexa.getIntentName(h.requestEnvelope)),
 handle:h=>say(h,locale(h).future)
};
const HelpHandler={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==="IntentRequest"&&Alexa.getIntentName(h.requestEnvelope)==="AMAZON.HelpIntent",
 handle:h=>say(h,locale(h).help)
};
const EndHandler={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==="IntentRequest"&&
 ["AMAZON.CancelIntent","AMAZON.StopIntent"].includes(Alexa.getIntentName(h.requestEnvelope)),
 handle:h=>say(h,"Até logo.")
};
const FallbackHandler={
 canHandle:h=>Alexa.getRequestType(h.requestEnvelope)==="IntentRequest",
 handle:h=>say(h,locale(h).help)
};
const ErrorHandler={canHandle:()=>true,handle:(h,error)=>{console.error("Alexa skill error",error);return say(h,locale(h).error);}};
exports.handler=Alexa.SkillBuilders.custom()
 .addRequestHandlers(LaunchHandler,InquiryHandler,UnsupportedHandler,HelpHandler,EndHandler,FallbackHandler)
 .addErrorHandlers(ErrorHandler).lambda();
