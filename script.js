const navButtons = document.querySelectorAll(".nav-btn");
const pages = document.querySelectorAll(".page");
const mineBtn = document.getElementById("mine-btn");
const mineStatus = document.getElementById("mine-status");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.getAttribute("data-target");
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById(target).classList.add("active");
  });
});

mineBtn.addEventListener("click", () => {
  mineBtn.innerText = "Mining...";
  mineStatus.innerHTML = "Mining started — come back after 2 hours to claim.";
});
