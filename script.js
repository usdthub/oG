// === Navigation ===
const sections = document.querySelectorAll(".section");
const navButtons = document.querySelectorAll(".nav-btn");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    sections.forEach((sec) => sec.classList.remove("active"));
    navButtons.forEach((b) => b.classList.remove("active"));
    document.getElementById(target).classList.add("active");
    btn.classList.add("active");
  });
});

// === Mining Logic with Auto Save ===
const mineBtn = document.getElementById("mineBtn");
const progressBar = document.getElementById("progressBar");
const timerDisplay = document.getElementById("timerDisplay");
const statusText = document.getElementById("status");
const trxValue = document.getElementById("trxValue");

let mining = false;
let timeLeft = 0;
let timer;

const savedEnd = localStorage.getItem("miningEnd");

if (savedEnd && Date.now() < parseInt(savedEnd)) {
  startMining(true);
} else {
  resetMining();
}

mineBtn.addEventListener("click", () => {
  if (!mining) {
    const end = Date.now() + 2 * 60 * 60 * 1000; // 2h
    localStorage.setItem("miningEnd", end);
    startMining();
  } else if (timeLeft <= 0) {
    claimReward();
  }
});

function startMining(resume = false) {
  mining = true;
  mineBtn.disabled = true;
  mineBtn.innerText = "Mining...";
  statusText.innerText = "Mining in progress ⛏️";

  timer = setInterval(() => {
    const end = parseInt(localStorage.getItem("miningEnd"));
    timeLeft = Math.floor((end - Date.now()) / 1000);

    if (timeLeft <= 0) {
      clearInterval(timer);
      finishMining();
    } else {
      updateDisplay();
    }
  }, 1000);
}

function updateDisplay() {
  const hrs = Math.floor(timeLeft / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);
  const secs = timeLeft % 60;
  timerDisplay.innerText = `Time left: ${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  const end = parseInt(localStorage.getItem("miningEnd"));
  const total = 2 * 60 * 60;
  const passed = total - timeLeft;
  const progress = Math.min((passed / total) * 100, 100);
  progressBar.style.width = `${progress}%`;
}

function finishMining() {
  mining = false;
  mineBtn.disabled = false;
  mineBtn.innerText = "Claim 5 TRX";
  statusText.innerText = "Mining complete! Click to claim reward.";
  progressBar.style.width = "100%";
  localStorage.removeItem("miningEnd");
}

function claimReward() {
  let balance = parseFloat(trxValue.innerText);
  balance += 5;
  trxValue.innerText = balance.toFixed(2) + " TRX";
  resetMining();
}

function resetMining() {
  mining = false;
  timeLeft = 0;
  mineBtn.disabled = false;
  mineBtn.innerText = "Start Mining";
  progressBar.style.width = "0%";
  timerDisplay.innerText = "Time left: 02:00:00";
  statusText.innerText = "Start mining — wait 2 hours — claim 5 TRX.";
}
