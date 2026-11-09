"use strict";
// Alexa OAuth2 bridge. No deployment or credential provisioning is performed by this file.
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {onRequest}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
if(!admin.apps.length)admin.initializeApp();
const db=admin.firestore();
const clientId=defineSecret("ALEXA_CLIENT_ID");
const clientSecret=defineSecret("ALEXA_CLIENT_SECRET");
const redirectUris=defineSecret("ALEXA_REDIRECT_URIS");
const apiBase="https://southamerica-east1-fincontrol-pro-6cc5d.cloudfunctions.net/alexaOAuth";
const loginUrl="https://mateusjk06.github.io/Fin-control-pro/alexa-skill/link.html";
const hash=v=>crypto.createHash("sha256").update(v).digest("hex");
const random=()=>crypto.randomBytes(32).toString("base64url");
const time=()=>Date.now();
const json=(res,status,body)=>res.status(status).set("Cache-Control","no-store").json(body);
const eq=(a,b)=>{
 const one=Buffer.from(String(a||"")),two=Buffer.from(String(b||""));
 return one.length===two.length&&crypto.timingSafeEqual(one,two);
};
const validRedirect=value=>{
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&redirectUris.value().split(/[\s,]+/).filter(Boolean).includes(u.href);
 }catch{return false;}
};
const post=req=>req.body||{};
const verifyRequest=p=>{
 if(p.response_type!=="code"||!eq(p.client_id,clientId.value())||!validRedirect(p.redirect_uri)||
 typeof p.state!=="string"||p.state.length<12||p.state.length>2048)return false;
 if(p.code_challenge&&(!/^[a-zA-Z0-9_-]{43,128}$/.test(p.code_challenge)||p.code_challenge_method!=="S256"))return false;
 return true;
};
function basicCredentials(req){
 const auth=req.get("authorization")||"";
 if(auth.startsWith("Basic ")){
  try{
   const v=Buffer.from(auth.slice(6),"base64").toString("utf8"),i=v.indexOf(":");
   if(i>=0)return {id:decodeURIComponent(v.slice(0,i)),secret:decodeURIComponent(v.slice(i+1))};
  }catch{}
 }
 return {id:post(req).client_id,secret:post(req).client_secret};
}
function clientAllowed(req,res){
 const c=basicCredentials(req);
 if(!eq(c.id,clientId.value())||!eq(c.secret,clientSecret.value())){
  res.set("WWW-Authenticate",'Basic realm="FinControl Alexa"');
  json(res,401,{error:"invalid_client"});return false;
 }
 return true;
}
async function consent(req,res){
 const p=post(req);
 if(!verifyRequest(p)||typeof p.idToken!=="string")return json(res,400,{error:"invalid_request"});
 let user;
 try{user=await admin.auth().verifyIdToken(p.idToken,true);}
 catch{return json(res,401,{error:"unauthorized"});}
 const code=random(),n=time();
 await db.collection("alexaOAuthCodes").doc(hash(code)).set({
  uid:user.uid,redirectUri:p.redirect_uri,clientId:p.client_id,challenge:p.code_challenge||"",
  used:false,expiresAt:n+120000,ttl:admin.firestore.Timestamp.fromMillis(n+86400000)
 });
 const redirect=new URL(p.redirect_uri);
 redirect.searchParams.set("code",code);
 redirect.searchParams.set("state",p.state);
 return json(res,200,{redirect:redirect.href});
}
async function issueTokens(uid){
 const access=random(),refresh=random(),n=time();
 const batch=db.batch();
 batch.set(db.collection("alexaOAuthTokens").doc(hash(access)),{
  uid,kind:"access",expiresAt:n+3600000,ttl:admin.firestore.Timestamp.fromMillis(n+86400000)});
 batch.set(db.collection("alexaOAuthTokens").doc(hash(refresh)),{
  uid,kind:"refresh",expiresAt:n+30*86400000,ttl:admin.firestore.Timestamp.fromMillis(n+31*86400000)});
 await batch.commit();
 return {access_token:access,token_type:"Bearer",expires_in:3600,refresh_token:refresh};
}
async function exchange(req,res){
 if(req.method!=="POST")return json(res,405,{error:"invalid_request"});
 if(!clientAllowed(req,res))return;
 const p=post(req);
 if(p.grant_type==="authorization_code"){
  if(typeof p.code!=="string"||!validRedirect(p.redirect_uri))return json(res,400,{error:"invalid_grant"});
  const ref=db.collection("alexaOAuthCodes").doc(hash(p.code));
  let uid;
  try{
   uid=await db.runTransaction(async tx=>{
    const doc=(await tx.get(ref)).data();
    if(!doc||doc.used||doc.expiresAt<time()||!eq(doc.clientId,clientId.value())||doc.redirectUri!==p.redirect_uri)throw Error("invalid");
    if(doc.challenge){
     if(typeof p.code_verifier!=="string"||!/^[a-zA-Z0-9_.~-]{43,128}$/.test(p.code_verifier)||
      !eq(crypto.createHash("sha256").update(p.code_verifier).digest("base64url"),doc.challenge))throw Error("invalid");
    }
    tx.update(ref,{used:true});return doc.uid;
   });
  }catch{return json(res,400,{error:"invalid_grant"});}
  return json(res,200,await issueTokens(uid));
 }
 if(p.grant_type==="refresh_token"){
  if(typeof p.refresh_token!=="string")return json(res,400,{error:"invalid_grant"});
  const ref=db.collection("alexaOAuthTokens").doc(hash(p.refresh_token));
  let uid;
  try{
   uid=await db.runTransaction(async tx=>{
    const doc=(await tx.get(ref)).data();
    if(!doc||doc.kind!=="refresh"||doc.expiresAt<time())throw Error("invalid");
    tx.delete(ref);return doc.uid;
   });
  }catch{return json(res,400,{error:"invalid_grant"});}
  return json(res,200,await issueTokens(uid));
 }
 return json(res,400,{error:"unsupported_grant_type"});
}
async function bearerUid(req){
 const m=/^Bearer ([A-Za-z0-9_-]{32,})$/.exec(req.get("authorization")||"");
 if(!m)return null;
 const data=(await db.collection("alexaOAuthTokens").doc(hash(m[1])).get()).data();
 return data&&data.kind==="access"&&data.expiresAt>time()?data.uid:null;
}
async function summary(req,res){
 const uid=await bearerUid(req);
 if(!uid)return json(res,401,{error:"invalid_token"});
 const snap=await db.collection("users").doc(uid).collection("appData").doc("main").get();
 if(!snap.exists)return json(res,404,{error:"no_financial_data"});
 const data=snap.data()||{};
 const bills=Array.isArray(data.bills)?data.bills.filter(x=>x&&!x.paid):[];
 const debts=Array.isArray(data.debts)?data.debts.filter(x=>x):[];
 return json(res,200,{
  currency:/^[A-Z]{3}$/.test(data.currency||"")?data.currency:"BRL",
  pendingBills:bills.length,
  pendingBillTotal:Math.round(bills.reduce((s,b)=>s+(Number(b.val)||0),0)*100)/100,
  outstandingDebtTotal:Math.round(debts.reduce((s,d)=>s+Math.max(0,Number(d.balance)||0),0)*100)/100,
  upcomingBills:bills.filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.date||""))
   .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10)
   .map(b=>({title:String(b.desc||"Conta").slice(0,80),due:b.date,amount:Number(b.val)||0}))
 });
}
exports.alexaOAuth=onRequest({
 region:"southamerica-east1",maxInstances:3,timeoutSeconds:30,
 invoker:"public",secrets:[clientId,clientSecret,redirectUris]
},async(req,res)=>{
 res.set("Cache-Control","no-store");
 const origin=req.get("origin");
 if(origin==="https://mateusjk06.github.io"){
  res.set("Access-Control-Allow-Origin",origin);
  res.set("Vary","Origin");
  res.set("Access-Control-Allow-Headers","Content-Type");
  res.set("Access-Control-Allow-Methods","POST,GET,OPTIONS");
 }
 if(req.method==="OPTIONS")return res.status(origin==="https://mateusjk06.github.io"?204:403).end();
 try{
  const action=String(req.query.action||"");
  if(action==="authorize"&&req.method==="GET"){
   if(!verifyRequest(req.query))return res.status(400).send("Requisição OAuth inválida.");
   const url=new URL(loginUrl);
   for(const key of ["response_type","client_id","redirect_uri","state","code_challenge","code_challenge_method"])
    if(typeof req.query[key]==="string")url.searchParams.set(key,req.query[key]);
   return res.redirect(302,url.href);
  }
  if(action==="consent"&&req.method==="POST")return await consent(req,res);
  if(action==="token")return await exchange(req,res);
  if(action==="summary"&&req.method==="GET")return await summary(req,res);
  if(action==="revoke"&&req.method==="POST"){
   if(!clientAllowed(req,res))return;
   if(typeof post(req).token==="string")
    await db.collection("alexaOAuthTokens").doc(hash(post(req).token)).delete();
   return json(res,200,{revoked:true});
  }
  return json(res,404,{error:"not_found"});
 }catch(e){console.error("Alexa OAuth:",e.code||e.message);return json(res,500,{error:"server_error"});}
});
