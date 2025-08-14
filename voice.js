// voice.js - backend helper that calls Gemini (Revolt sales/support assistant)
require("dotenv").config();
const fetch = global.fetch || require("node-fetch"); // Node 18+ has global fetch

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // default model

/**
 * sendTextToGemini(text)
 * Sends user text to Gemini API and returns Revolt-focused short, friendly reply.
 */
async function sendTextToGemini(text) {
  if (!GEMINI_KEY) {
    return `Rev (mock): I heard "${text}". (Gemini key missing — using mock reply.)`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      MODEL
    )}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{
            text: `You are Rev, the official voice assistant for Revolt Motors.
Your personality: friendly, knowledgeable, and helpful like a showroom representative.
Your job: answer user questions in one short, engaging sentence.
Tone: sales/support oriented, professional but approachable.
Always focus on Revolt Electric Motorcycles, especially models like the RV400, RV300, and related services.
Highlight features, benefits, and support info.
Avoid topics unrelated to Revolt Motors.
User query: ${text}`
          }]
        }
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 503) {
        console.warn("Gemini 503: retrying once...");
        await new Promise(r => setTimeout(r, 1000));
        return await sendTextToGemini(text); // retry once
      }
      const errText = await res.text().catch(() => "unknown error");
      console.warn("Gemini returned non-OK:", res.status, errText);
      return `Rev (mock): I heard "${text}". (Gemini returned ${res.status})`;
    }

    const json = await res.json().catch(() => null);
    const candidate = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (candidate && typeof candidate === "string") {
      return candidate;
    }

    return `Rev (mock): I heard "${text}". (Gemini returned unexpected structure.)`;
  } catch (err) {
    console.error("Gemini call failed:", err?.message || err);
    return `Rev (mock): I heard "${text}". (Gemini error: ${err.message || err})`;
  }
}

module.exports = { sendTextToGemini };
