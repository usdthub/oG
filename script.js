/* === CONFIG - keep your API/token values here if you want Telegram notifications === */
const TELEGRAM_BOT_TOKEN = ""; // <- place your bot token here if you want telegram notifications
const ADMIN_CHAT_ID = ""; // <- place admin chat id here

/* === CONSTANTS === */
const TRX_PRICE_USDT = 0.002;
const REWARD_TRX = 5;
const MINING_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours in ms
const VIP_PLANS = {
  vip1: { cost: 0.10, daily: 0.40, label: "VIP 1" },
  vip2: { cost: 0.20, daily: 0.15, label: "VIP 2" }
};

/* === localStorage helpers === */
function loadState(){
  try{
    const raw = localStorage.getItem('trx_app_v2');
    if(raw) return JSON.parse(raw);
  }catch(e){}
  // default state
  return {
    trx: 20,
    usdt: 20 * TRX_PRICE_USDT,
    teamCount: 0,
    miningActive: false,
    miningEnd: null,
    miningHistory: [],
    withdrawRequests: [],
    vipRequests: [],
    refId: null,
  };
}
function saveState(s){ localStorage.setItem('trx_app_v2', JSON.stringify(s)); }

/* === state === */
let state = loadState();
if(!state.refId){ state.refId = Math.random().toString(36).slice(2,9); saveState(state); }

/* === DOM refs === */
const pages = { mine: document.getElementById('page-mine'), team: document.getElementById('page-team'), me: document.getElementById('page-me'), vip: document.getElementById('page-vip') };
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
const trxAmountEl = document.getElementById('trxAmount');
const meTRXEl = document.getElementById('meTRX');
const meUSDTEl = document.getElementById('meUSDT');
const progressInner = document.getElementById('progressInner');
const progressTimer = document.getElementById('progressTimer');
const mineActionBtn = document.getElementById('mineActionBtn');
const mineStatus = document.getElementById('mineStatus');
const mineMessage = document.getElementById('mineMessage');
const miningHistoryEl = document.getElementById('miningHistory');
const refLinkEl = document.getElementById('refLink');
const teamCountEl = document.getElementById('teamCount');
const copyRefBtn = document.getElementById('copyRefBtn');
const fakeInviteBtn = document.getElementById('fakeInviteBtn');

// ME page refs
const convertInput = document.getElementById('convertInput');
const convertDo = document.getElementById('convertDo');
const convertResult = document.getElementById('convertResult');
const withdrawMethod = document.getElementById('withdrawMethod');
const withdrawUID = document.getElementById('withdrawUID');
const withdrawAmount = document.getElementById('withdrawAmount');
const submitWithdraw = document.getElementById('submitWithdraw');
const withdrawMsg = document.getElementById('withdrawMsg');

// VIP refs
const buyVipBtns = Array.from(document.querySelectorAll('.buyVipBtn'));
const vipFormWrap = document.getElementById('vipFormWrap');
const vipFormTitle = document.getElementById('vipFormTitle');
const vipExchange = document.getElementById('vipExchange');
const vipSenderUID = document.getElementById('vipSenderUID');
const vipMemo = document.getElementById('vipMemo');
const vipFile = document.getElementById('vipFile');
const vipSubmit = document.getElementById('vipSubmit');
const vipCancel = document.getElementById('vipCancel');
const vipMsg = document.getElementById('vipMsg');

/* === UI: navigation === */
navBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.target;
    Object.values(pages).forEach(p=>p.classList.remove('active'));
    document.getElementById(target).classList.add('active');
  });
});

/* === Render === */
let miningInterval = null;
function renderAll(){
  trxAmountEl.innerText = parseFloat(state.trx).toFixed(2) + ' TRX';
  meTRXEl && (meTRXEl.innerText = parseFloat(state.trx).toFixed(2));
  meUSDTEl && (meUSDTEl.innerText = parseFloat(state.usdt).toFixed(6));
  teamCountEl && (teamCountEl.innerText = state.teamCount);
  if(!state.refId){ state.refId = Math.random().toString(36).slice(2,9); saveState(state); }
  refLinkEl && (refLinkEl.value = `${location.origin}${location.pathname}?ref=${state.refId}`);
  renderMiningUI();
  renderHistory();
  saveState(state);
}
function renderHistory(){
  if(!miningHistoryEl) return;
  miningHistoryEl.innerHTML = '';
  (state.miningHistory || []).slice().reverse().forEach(h=>{
    const li = document.createElement('li');
    li.innerText = `${h.text} — ${new Date(h.time).toLocaleString()}`;
    miningHistoryEl.appendChild(li);
  });
}

/* === Mining UI & logic (persistent) === */
function updateMiningUI(){
  if(state.miningActive && state.miningEnd){
    const remaining = state.miningEnd - Date.now();
    if(remaining <= 0){
      // ready
      progressInner.style.width = '100%';
      progressTimer.innerText = 'Ready to claim';
      mineActionBtn.innerText = `Collect Reward (${calcReward()} TRX)`;
      mineActionBtn.disabled = false;
      mineStatus.innerText = 'Completed';
      mineActionBtn.onclick = collectReward;
      if(miningInterval){ clearInterval(miningInterval); miningInterval = null; }
      // animate pickaxe active
      showPickaxe(true);
    } else {
      const pct = Math.max(0, Math.min(100, ((MINING_DURATION_MS - remaining)/MINING_DURATION_MS)*100));
      progressInner.style.width = pct + '%';
      const hrs = Math.floor(remaining / (1000*60*60));
      const mins = Math.floor((remaining % (1000*60*60)) / (1000*60));
      const secs = Math.floor((remaining % (1000*60)) / 1000);
      progressTimer.innerText = `Time: ${hrs}h ${mins}m ${secs}s`;
      mineActionBtn.innerText = 'Mining...';
      mineActionBtn.disabled = true;
      mineStatus.innerText = 'Mining';
      mineActionBtn.onclick = null;
      if(!miningInterval){
        miningInterval = setInterval(()=>{ updateMiningUI(); },1000);
      }
      showPickaxe(true);
    }
  } else {
    progressInner.style.width = '0%';
    progressTimer.innerText = 'Not started';
    mineActionBtn.innerText = 'Start Mining';
    mineActionBtn.disabled = false;
    mineStatus.innerText = 'Not started';
    mineActionBtn.onclick = startMining;
    if(miningInterval){ clearInterval(miningInterval); miningInterval = null; }
    showPickaxe(false);
  }
}
function renderMiningUI(){ updateMiningUI(); }

// pickaxe injection + toggle
(function addMiningAnimationAddon(){
  const mineCard = document.querySelector('.mine-card');
  if(!mineCard) return;
  if(mineCard.querySelector('.mine-anim')) return; // already added
  const animWrap = document.createElement('div');
  animWrap.className = 'mine-anim';
  animWrap.innerHTML = `
    <svg class="pickaxe" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="gA" x1="0" x2="1">
          <stop offset="0" stop-color="#1aff9b" stop-opacity="0.95"/>
          <stop offset="1" stop-color="#00c56a" stop-opacity="0.95"/>
        </linearGradient>
      </defs>
      <g transform="translate(12,18)">
        <ellipse cx="48" cy="62" rx="44" ry="18" fill="#072b1a" opacity="0.95"/>
      </g>
      <g transform="translate(18,0) rotate(-12 48 48)">
        <rect x="66" y="18" width="10" height="58" rx="5" fill="#6b6b6b" transform="rotate(-22 71 47)"/>
        <path d="M12 62c0 0 36-4 48-28 0 0 10 6 8 16-2 10-18 30-32 34-14 4-32-4-24-22z" fill="url(#gA)" opacity="0.98"/>
      </g>
    </svg>
  `;
  mineCard.appendChild(animWrap);
})();
function showPickaxe(on){
  const anim = document.querySelector('.mine-anim');
  if(!anim) return;
  if(on) anim.classList.add('anim-active'); else anim.classList.remove('anim-active');
}

// mining functions
function calcReward(){ return state.vipActive === 'vip1' ? REWARD_TRX * 50 : (state.vipActive === 'vip2' ? REWARD_TRX * 100 : REWARD_TRX); /* simple multiplier placeholder */ }

function startMining(){
  if(state.miningActive) return;
  state.miningActive = true;
  state.miningEnd = Date.now() + MINING_DURATION_MS;
  state.miningStart = Date.now();
  saveState(state);
  mineMessage && (mineMessage.innerText = `Mining started — come back after ${MINING_DURATION_MS/(1000*60*60)} hours to claim.`);
  renderAll();
}

function collectReward(){
  const reward = calcReward();
  state.trx = parseFloat((parseFloat(state.trx) + reward).toFixed(6));
  state.usdt = parseFloat((state.trx * TRX_PRICE_USDT).toFixed(6));
  state.miningActive = false;
  state.miningEnd = null;
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: `+${reward} TRX (mine)`, time: Date.now() });
  saveState(state);
  mineMessage && (mineMessage.innerText = `✅ You collected ${reward} TRX!`);
  sendTelegramMessage(`⛏️ Claim -> Ref:${state.refId}\nReward:${reward} TRX\nNew TRX:${state.trx.toFixed(6)}`);
  renderAll();
}

/* === Convert TRX -> USDT (ME) === */
convertDo?.addEventListener('click', ()=>{
  const v = parseFloat(convertInput.value || 0);
  if(!v || v <= 0){ alert('Enter TRX amount'); return; }
  if(v > state.trx){ alert('Not enough TRX'); return; }
  const converted = v * TRX_PRICE_USDT;
  state.trx = parseFloat((state.trx - v).toFixed(6));
  state.usdt = parseFloat((state.usdt + converted).toFixed(6));
  saveState(state);
  convertResult.innerText = `Converted ${v} TRX → ${converted.toFixed(6)} USDT`;
  sendTelegramMessage(`🔁 Convert\nRef:${state.refId}\nTRX:${v}\nUSDT:${converted.toFixed(6)}`);
  renderAll();
});

/* === Withdraw ===
   - withdrawMethod: bitget / bybit
   - min amount: 0.01 USDT
*/
submitWithdraw?.addEventListener('click', ()=>{
  const method = withdrawMethod.value;
  const uid = withdrawUID.value.trim();
  const amount = parseFloat(withdrawAmount.value||0);
  if(!uid){ alert('Enter UID'); return; }
  if(isNaN(amount) || amount < 0.01){ alert('Enter valid amount >= 0.01 USDT'); return; }
  if(amount > state.usdt){ alert('Not enough USDT'); return; }
  // store request
  state.usdt = parseFloat((state.usdt - amount).toFixed(6));
  state.withdrawRequests = state.withdrawRequests || [];
  const req = { ref: state.refId, method, uid, amount, time: Date.now() };
  state.withdrawRequests.push(req);
  saveState(state);
  withdrawMsg.innerText = `Withdraw submitted: ${amount.toFixed(6)} USDT to ${method} UID ${uid}`;
  sendTelegramMessage(`💸 Withdraw\nRef:${state.refId}\nMethod:${method}\nUID:${uid}\nAmount:${amount.toFixed(6)} USDT`);
  renderAll();
});

/* === Invite / Copy ref === */
fakeInviteBtn?.addEventListener('click', ()=>{
  state.teamCount = parseInt(state.teamCount) + 1;
  saveState(state);
  renderAll();
});
copyRefBtn?.addEventListener('click', ()=> {
  refLinkEl && navigator.clipboard && navigator.clipboard.writeText(refLinkEl.value);
  alert('Referral link copied!');
});

/* === VIP flow ===
   - Buy button -> show form with exchange select
   - Submit -> save vipRequests & send Telegram message with details
   - Admin will activate via Telegram externally
*/
let selectedVipPlan = null;
buyVipBtns.forEach(b=>{
  b.addEventListener('click', ()=>{
    selectedVipPlan = b.dataset.v;
    vipFormTitle.innerText = `Pay for ${VIP_PLANS[selectedVipPlan].label} — ${VIP_PLANS[selectedVipPlan].cost} USDT`;
    vipMsg.innerText = `Send ${VIP_PLANS[selectedVipPlan].cost} USDT to one of official accounts (Bitget/Bybit). Then upload proof and submit.`;
    vipFormWrap.classList.remove('hidden');
  });
});
vipCancel?.addEventListener('click', ()=>{
  vipFormWrap.classList.add('hidden');
  selectedVipPlan = null;
  vipMsg.innerText = '';
});

vipSubmit?.addEventListener('click', ()=>{
  const exch = vipExchange.value;
  const sender = vipSenderUID.value.trim();
  const memo = vipMemo.value.trim();
  const file = vipFile.files[0];
  if(!selectedVipPlan){ alert('Choose a VIP plan'); return; }
  if(!sender || !memo){ alert('Enter sender UID and memo'); return; }
  // store request
  state.vipRequests = state.vipRequests || [];
  const req = { plan: selectedVipPlan, ref: state.refId, exchange: exch, sender, memo, time: Date.now() };
  state.vipRequests.push(req);
  saveState(state);
  vipMsg.innerText = 'VIP request submitted. Admin will review within 24h.';
  // store file as base64 demo (optional)
  if(file){
    const reader = new FileReader();
    reader.onload = e => { state[`vip_proof_${Date.now()}`] = e.target.result; saveState(state); };
    reader.readAsDataURL(file);
  }
  // notify admin
  sendTelegramMessage(`🌟 VIP Request\nPlan:${selectedVipPlan}\nRef:${state.refId}\nExchange:${exch}\nSender:${sender}\nMemo:${memo}\nFee:${VIP_PLANS[selectedVipPlan].cost} USDT`);
  // hide form after submit
  vipFormWrap.classList.add('hidden');
  selectedVipPlan = null;
});

/* === Telegram sender (only if token + chat id present) === */
function sendTelegramMessage(message){
  if(!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID){ console.log('TG not configured:', message); return; }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: message })
  }).then(r=>r.json()).then(j=>console.log('tg ok', j)).catch(e=>console.error('tg err', e));
}

/* === Startup: resume mining if needed, initial render === */
(function init(){
  // types
  state.trx = parseFloat(state.trx);
  state.usdt = parseFloat(state.usdt);
  // resume mining if end in future
  if(state.miningEnd && Date.now() < state.miningEnd){
    state.miningActive = true;
    renderAll();
  } else {
    // clear if expired but not claimed
    if(state.miningEnd && Date.now() >= state.miningEnd){
      // mark ready but not auto-claim
      state.miningActive = false;
      state.miningEnd = null;
      saveState(state);
    }
    renderAll();
  }
})();
