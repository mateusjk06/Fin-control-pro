/* FinControl Pro — background web push */
self.addEventListener("push",event=>{
  let payload={};
  try{payload=event.data?.json()||{};}catch{payload={};}
  const data=payload.data||{};
  const notification=payload.notification||{};
  const title=String(data.title||notification.title||"FinControl Pro");
  const body=String(data.body||notification.body||"Você tem vencimentos pendentes.");
  event.waitUntil(self.registration.showNotification(title,{
    body,icon:"./favicon.ico",tag:"fincontrol-vencimentos",renotify:false,
    data:{url:"./"}
  }));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL("./",self.registration.scope).href;
    const windows=await clients.matchAll({type:"window",includeUncontrolled:true});
    const current=windows.find(w=>w.url.startsWith(target));
    if(current){await current.focus();return;}
    await clients.openWindow(target);
  })());
});
