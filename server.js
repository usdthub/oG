import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Telegram Control Bot Active!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
