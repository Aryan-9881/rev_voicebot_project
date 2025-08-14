require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { sendTextToGemini } = require("./voice");
const path = require("path");

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "..")));

// Route to load index.html at "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

app.locals.sessions = new Map();

app.post("/api/voice/query", async (req, res) => {
  try {
    const { text, clientId } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "text required" });
    }

    const sessionKey = clientId || uuidv4();
    if (!app.locals.sessions.has(sessionKey)) {
      app.locals.sessions.set(sessionKey, { created: Date.now() });
    }

    const reply = await sendTextToGemini(text);
    return res.json({ ok: true, text: reply, clientId: sessionKey });
  } catch (err) {
    console.error("Query handler failed:", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
});

app.post("/api/voice/interrupt", (req, res) => {
  const { clientId } = req.body || {};
  if (!clientId) return res.status(400).json({ ok: false, error: "clientId required" });

  if (!app.locals.sessions.has(clientId)) {
    return res.status(404).json({ ok: false, error: "client session not found" });
  }

  app.locals.sessions.delete(clientId);
  return res.json({ ok: true, interrupted: true });
});

app.listen(PORT, () => {
  console.log(`Static files path: ${path.join(__dirname, "..")}`);
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
