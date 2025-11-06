// Mining button and progress setup
const miningButton = document.getElementById("miningButton");
const miningStatus = document.getElementById("miningStatus");
const progressBar = document.getElementById("progressBar");
const timerDisplay = document.getElementById("timerDisplay");

let miningActive = false;
let totalTime = 2 * 60 * 60; // 2 hours in seconds
let remainingTime = totalTime;
let timer;

// Convert seconds to HH:MM:SS format
function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// Update timer + progress bar
function updateMiningProgress() {
  if (remainingTime > 0) {
    remainingTime--;
    const progressPercent = ((totalTime - remainingTime) / totalTime) * 100;
    progressBar.style.width = `${progressPercent}%`;
    timerDisplay.textContent = `Time left: ${formatTime(remainingTime)}`;
  } else {
    clearInterval(timer);
    miningActive = false;
    miningButton.textContent = "Claim 5 TRX";
    miningStatus.textContent = "✅ Mining complete — Claim your reward!";
  }
}

// Mining button click
miningButton.addEventListener("click", () => {
  if (!miningActive) {
    miningActive = true;
    remainingTime = totalTime;
    progressBar.style.width = "0%";
    miningButton.textContent = "Mining...";
    miningStatus.textContent = "Mining started — come back after 2 hours to claim.";
    timerDisplay.textContent = `Time left: ${formatTime(remainingTime)}`;
    timer = setInterval(updateMiningProgress, 1000);
  } else if (remainingTime <= 0) {
    alert("🎉 You claimed 5 TRX!");
    miningButton.textContent = "Start Mining Again";
    miningStatus.textContent = "Mining reset — start again anytime.";
  }
});
