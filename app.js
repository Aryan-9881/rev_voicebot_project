const themeToggle = document.getElementById("theme-toggle");
const body = document.body;
const btn = document.getElementById("sessionToggleButton");
const status = document.getElementById("statusMessage");

let recognition = null;
let listening = false;
let clientId = null;
let pendingRequest = false;

themeToggle.addEventListener("change", () => 
  body.classList.toggle("dark-mode", themeToggle.checked)
);

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSTT = !!SR;
const hasTTS = "speechSynthesis" in window;

function playBeep(type = "start") {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = type === "start" ? 800 : 450;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    setTimeout(() => { try { o.stop(); ctx.close(); } catch {} }, 250);
  } catch (e) { console.warn("Beep failed:", e); }
}

function initRecognition() {
  if (!hasSTT) return null;
  const r = new SR();
  r.lang = "en-IN";
  r.interimResults = true;
  r.continuous = true;

  r.onstart = () => { status.textContent = "Listening…"; };
  r.onerror = (e) => { 
    console.error("STT error", e);
    status.textContent = "STT error: " + (e.error || e.message); 
  };
  r.onend = () => {
    if (listening) {
      try { r.start(); } catch (e) { console.warn("restart failed", e); }
    } else {
      status.textContent = "Stopped.";
    }
  };

  r.onresult = (ev) => {
    let finalText = "";
    for (let i = ev.resultIndex; i < ev.results.length; ++i) {
      const res = ev.results[i];
      if (res.isFinal) {
        finalText = res[0].transcript.trim();
        if (finalText && !pendingRequest) {
          pendingRequest = true;
          sendTextToServer(finalText).finally(() => {
            pendingRequest = false;
          });
        }
      }
    }
    // ✅ Removed on-screen transcript display
  };

  return r;
}

async function sendTextToServer(text) {
  if (!text) return;
  status.textContent = "Processing...";
  try {
    const res = await fetch("http://localhost:5000/api/voice/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, clientId })
    });
    const j = await res.json();
    if (j.ok) {
      clientId = j.clientId || clientId;
      if (hasTTS) speakText(j.text); // ✅ Speak reply but don't display it
      status.textContent = "Ready";
    } else {
      status.textContent = "Server error: " + (j.error || "unknown");
    }
  } catch (e) {
    console.error("Query failed:", e);
    status.textContent = "Network or server error";
  }
}

function speakText(text) {
  if (!hasTTS || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  u.rate = 1.0;
  u.pitch = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

btn.addEventListener("click", async () => {
  if (!hasSTT) {
    alert("SpeechRecognition (STT) is not available in this browser. Use Chrome or Edge.");
    return;
  }

  if (!listening) {
    playBeep("start");
    if (!recognition) recognition = initRecognition();
    try {
      recognition.start();
      listening = true;
      btn.classList.add("active-session");
      status.textContent = "Listening…";
    } catch (e) {
      console.warn("start failed:", e);
      status.textContent = "Could not start microphone";
    }
  } else {
    playBeep("stop");
    try {
      recognition.stop();
    } catch (e) { console.warn("stop failed", e); }
    listening = false;
    btn.classList.remove("active-session");
    status.textContent = "Stopped";
    if (clientId) {
      try {
        await fetch("http://localhost:5000/api/voice/interrupt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId })
        });
      } catch (e) { console.warn("interrupt failed", e); }
    }
  }
});
