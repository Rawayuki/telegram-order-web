(function(){
"use strict";

let deferredInstallPrompt = null;
let registrationRef = null;
let refreshing = false;

function toast(message,type="success"){
  if(window.DBTUI && DBTUI.toast){
    DBTUI.toast(message,type);
  }else{
    console.log(message);
  }
}

function injectStyles(){
  if(document.getElementById("dbtPwaStyles")) return;

  const style=document.createElement("style");
  style.id="dbtPwaStyles";
  style.textContent=`
  .dbt-pwa-install{
    position:fixed;left:18px;bottom:18px;z-index:1450;
    display:none;align-items:center;gap:8px;
    border:none;border-radius:14px;padding:11px 13px;
    background:#111827;color:#fff;font:800 11px Arial,sans-serif;
    box-shadow:0 12px 32px rgba(17,24,39,.24);cursor:pointer
  }
  .dbt-pwa-install.show{display:flex}
  .dbt-pwa-update{
    position:fixed;left:50%;bottom:22px;transform:translateX(-50%);
    z-index:1900;display:none;align-items:center;gap:10px;
    width:min(520px,calc(100% - 28px));padding:12px 13px;border-radius:14px;
    background:#111827;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.3);
    font:700 11px Arial,sans-serif
  }
  .dbt-pwa-update.show{display:flex}
  .dbt-pwa-update span{flex:1;line-height:1.45}
  .dbt-pwa-update button{border:none;border-radius:9px;padding:8px 10px;background:#ff6b35;color:white;font:900 10px Arial,sans-serif;cursor:pointer}
  .dbt-pwa-status{
    position:fixed;left:18px;bottom:18px;z-index:1440;
    display:none;padding:8px 10px;border-radius:30px;background:#ecfdf5;color:#166534;
    font:800 9px Arial,sans-serif;border:1px solid #bbf7d0
  }
  @media(max-width:650px){
    .dbt-pwa-install,.dbt-pwa-status{left:12px;bottom:12px}
    .dbt-pwa-update{bottom:12px}
  }`;
  document.head.appendChild(style);
}

function createUI(){
  injectStyles();

  const install=document.createElement("button");
  install.id="dbtPwaInstall";
  install.type="button";
  install.className="dbt-pwa-install";
  install.innerHTML="⬇️ ติดตั้งแอป";
  install.addEventListener("click",installApp);
  document.body.appendChild(install);

  const update=document.createElement("div");
  update.id="dbtPwaUpdate";
  update.className="dbt-pwa-update";
  update.innerHTML=`
    <span>✨ มีเวอร์ชันใหม่ของ DBT Multi Shop พร้อมใช้งาน</span>
    <button type="button" id="dbtPwaUpdateButton">อัปเดต</button>`;
  document.body.appendChild(update);

  update.querySelector("button").addEventListener("click",()=>{
    if(registrationRef && registrationRef.waiting){
      registrationRef.waiting.postMessage({type:"SKIP_WAITING"});
    }else{
      location.reload();
    }
  });

  if(window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone===true){
    document.documentElement.dataset.pwaStandalone="true";
  }
}

async function installApp(){
  if(!deferredInstallPrompt){
    toast("ถ้าปุ่มติดตั้งยังไม่ขึ้น ให้เปิดเว็บผ่าน Render/HTTPS ก่อน","error");
    return;
  }

  deferredInstallPrompt.prompt();

  try{
    await deferredInstallPrompt.userChoice;
  }catch(_){}

  deferredInstallPrompt=null;
  document.getElementById("dbtPwaInstall")?.classList.remove("show");
}

function showUpdate(){
  document.getElementById("dbtPwaUpdate")?.classList.add("show");
}

async function registerSW(){
  if(!("serviceWorker" in navigator)) return;

  if(location.protocol!=="https:" && location.hostname!=="localhost"){
    return;
  }

  try{
    const registration=await navigator.serviceWorker.register("./sw.js");
    registrationRef=registration;

    if(registration.waiting && navigator.serviceWorker.controller){
      showUpdate();
    }

    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      if(!worker) return;

      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed" && navigator.serviceWorker.controller){
          showUpdate();
        }
      });
    });

    setInterval(()=>{
      registration.update().catch(()=>{});
    }, 5*60*1000);

  }catch(error){
    console.warn("PWA registration failed:",error);
  }
}

window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  document.getElementById("dbtPwaInstall")?.classList.add("show");
});

window.addEventListener("appinstalled",()=>{
  deferredInstallPrompt=null;
  document.getElementById("dbtPwaInstall")?.classList.remove("show");
  toast("ติดตั้ง DBT Multi Shop แล้ว 🎉","success");
});

navigator.serviceWorker?.addEventListener("controllerchange",()=>{
  if(refreshing) return;
  refreshing=true;
  location.reload();
});

window.addEventListener("online",()=>{
  toast("กลับมาออนไลน์แล้ว 📶","success");
});

window.addEventListener("offline",()=>{
  toast("ออฟไลน์อยู่ ข้อมูลสดจะหยุดอัปเดตชั่วคราว","error");
});

function start(){
  createUI();
  registerSW();
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",start,{once:true});
}else{
  start();
}

window.DBTPWA={
  install:installApp,
  checkUpdate:()=>registrationRef?.update()
};

})();