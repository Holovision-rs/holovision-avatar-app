import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import openai from "./openaiClient.js";
import { lipSync } from "./modules/lip-sync.mjs";
import { sendDefaultMessages, defaultResponse } from "./modules/defaultMessages.mjs";
import { convertAudioToText } from "./modules/whisper.mjs";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import fs from "fs";

dotenv.config();

console.log("OPENAI:", !!process.env.OPENAI_API_KEY);
console.log("MONGO:", !!process.env.MONGO_URI);
console.log("ELEVEN:", !!process.env.ELEVEN_LABS_API_KEY);

process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("🔥 UNHANDLED REJECTION:", err);
});

const app = express();

// ✅ osiguraj folder za audio output
fs.mkdirSync("audios", { recursive: true });

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// ======================
// CORS (manual, stabilno)
// ======================
const allowedOrigins = new Set([
  "https://holovision-avatar-app-1.onrender.com", // frontend
  "http://localhost:5173",
]);

const applyCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  }
};

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    applyCorsHeaders(req, res);
    return res.sendStatus(204);
  }
  applyCorsHeaders(req, res);
  next();
});

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// API rute
app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);

// 👇 OVDE IDE
app.get("/voices", async (req, res) => {
  try {
    const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

    if (!elevenLabsApiKey) {
      return res.status(400).json({
        error: "Missing ELEVEN_LABS_API_KEY",
      });
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000); // ⚡ timeout

    const r = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": elevenLabsApiKey,
      },
      signal: controller.signal,
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return res.status(r.status).json({
        error: "ElevenLabs voices failed",
        details: t,
      });
    }

    const data = await r.json();
    res.json(data);

  } catch (e) {
    console.error("🔥 Voices route error:", e);

    res.status(500).json({
      error: "Voices error",
      message: e?.message || String(e),
    });
  }
});
// ======================
// AVATAR GUARDIAN LAYER
// ======================
const GUARD = {
  name: "Torin",
  brand: "HOLOVISION",
  maxWebMs: 10000,
  bannedPhrases: [
    "i am chatgpt",
    "i’m chatgpt",
    "i am an ai developed by openai",
    "as an ai developed by openai",
    "openai",
    "chatgpt",
    "gpt",
  ],
};

const normalize = (s = "") =>
  (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const HARD_INTENTS = [
  {
    id: "identity_name",
    triggers: ["kako se zoves", "kako se zoveš", "your name", "what is your name"],
    reply: {
      messages: [
        {
          text: `Ja sam ${GUARD.name}, AI virtualni asistent ${GUARD.brand}-a.`,
          facialExpression: "smile",
          animation: "TalkingOne",
        },
      ],
    },
  },
  {
    id: "identity_who",
    triggers: ["ko si", "who are you", "šta si", "sta si", "what are you"],
    reply: {
      messages: [
        {
          text: `Ja sam ${GUARD.name} — AI avatar asistent. Tu sam da pomognem oko informacija, objašnjenja i zadataka.`,
          facialExpression: "default",
          animation: "Idle",
        },
      ],
    },
  },
  {
    id: "identity_chatgpt",
    triggers: ["da li si chatgpt", "jesi chatgpt", "are you chatgpt", "are you openai", "da li si openai"],
    reply: {
      messages: [
        {
          text: `Ne. Ja sam ${GUARD.name}, AI avatar ${GUARD.brand}-a.`,
          facialExpression: "default",
          animation: "Idle",
        },
      ],
    },
  },
  {
    id: "identity_creator",
    triggers: ["ko te je napravio", "ko te napravio", "who made you", "who created you"],
    reply: {
      messages: [
        {
          text: `${GUARD.brand} tim me je razvio kao AI avatar asistenta.`,
          facialExpression: "smile",
          animation: "TalkingTwo",
        },
      ],
    },
  },
];

const matchHardIntent = (q = "") => {
  const s = normalize(q);
  for (const intent of HARD_INTENTS) {
    if (intent.triggers.some((t) => s.includes(normalize(t)))) {
      console.log("🛡️ HARD_INTENT:", intent.id);
      return intent.reply;
    }
  }
  return null;
};

const WEB_KEYWORDS = [
  "danas",
  "trenutno",
  "sad",
  "najnovije",
  "vesti",
  "cena",
  "kurs",
  "2025",
  "2026",
  "link",
  "gde mogu",
  "koliko kosta",
  "koliko košta",
  "price",
  "today",
  "now",
  "latest",
  "news",
  "rate",
];

const shouldUseWeb = (q = "") => {
  const s = normalize(q);
  return WEB_KEYWORDS.some((k) => s.includes(normalize(k)));
};

const sanitizeAssistantText = (text = "") => {
  const t = text || "";
  const lower = t.toLowerCase();

  if (GUARD.bannedPhrases.some((p) => lower.includes(p))) {
    return `Ja sam ${GUARD.name}, AI avatar ${GUARD.brand}-a. Kako mogu da pomognem?`;
  }
  return t;
};

// --- TIMEOUT helper (max 10s) ---
const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT_${ms}ms`)), ms)
    ),
  ]);

const BASE_SYSTEM = `Ti si ${GUARD.name}, profesionalni AI avatar za ${GUARD.brand}.
Nikada ne reci da si ChatGPT ili OpenAI. Odgovaraj kratko i jasno.`;

const answerFastNoWeb = async (userMessage) => {
  const r = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input: [
      { role: "system", content: BASE_SYSTEM },
      { role: "user", content: userMessage },
    ],
  });

  const text = sanitizeAssistantText((r.output_text || "").trim());

  return {
    messages: [
      {
        text: text || "Ne mogu trenutno da pronađem odgovor.",
        facialExpression: "default",
        animation: "Idle",
      },
    ],
  };
};

const answerWeb = async (userMessage) => {
  const r = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    tools: [{ type: "web_search" }],
    input: [
      { role: "system", content: BASE_SYSTEM + " Koristi web samo kad je neophodno." },
      { role: "user", content: userMessage },
    ],
  });

  const text = sanitizeAssistantText((r.output_text || "").trim());

  return {
    messages: [
      {
        text: text || "Ne mogu trenutno da pronađem odgovor.",
        facialExpression: "default",
        animation: "Idle",
      },
    ],
  };
};

// ✅ UNIVERSAL: hard intent -> fast -> web<=10s -> fallback fast
const answerUniversal = async (userMessage) => {
  console.log("🧠 question:", userMessage);

  const hard = matchHardIntent(userMessage);
  if (hard) return hard;

  if (!shouldUseWeb(userMessage)) {
    console.log("⚡ FAST (no web)");
    return await answerFastNoWeb(userMessage);
  }

  console.log(`🌐 WEB (max ${GUARD.maxWebMs}ms)...`);
  try {
    return await withTimeout(answerWeb(userMessage), GUARD.maxWebMs);
  } catch (e) {
    console.warn("🌐 Web timeout/fail -> FAST fallback:", e?.message || e);
    return await answerFastNoWeb(userMessage);
  }
};

// ======================
// ROUTES
// ======================

// TTS
app.post("/tts", async (req, res, next) => {
  try {
    const userMessage = req.body.message;

    const defaultMessages = await sendDefaultMessages({ userMessage });
    if (defaultMessages) return res.send({ messages: defaultMessages });

    let openAImessages = defaultResponse;
    try {
      openAImessages = await answerUniversal(userMessage);
    } catch (e) {
      console.error("❌ /tts answer error:", e);
    }

    const msgs =
      Array.isArray(openAImessages?.messages) && openAImessages.messages.length
        ? openAImessages.messages
        : defaultResponse?.messages || [];

    const jobId = crypto.randomUUID();

    let response;
    try {
      response = await lipSync({ messages: msgs, jobId });
    } catch (err) {
      console.error("🔥 /tts LIPSYNC CRASH:", err);
      return res.status(500).json({ error: "LipSync failed" });
    }

    res.send({ messages: response });
  } catch (err) {
    next(err);
  }
});

// STS
app.post("/sts", async (req, res, next) => {
  try {
    let base64Audio = req.body?.audio;

    if (!base64Audio || typeof base64Audio !== "string") {
      return res.status(400).send({ error: "Missing audio (base64)" });
    }

    if (base64Audio.startsWith("data:")) {
      base64Audio = base64Audio.split("base64,")[1] || "";
    }

    const audioData = Buffer.from(base64Audio, "base64");
    if (!audioData.length) return res.status(400).send({ error: "Decoded audio is empty" });

    console.log("audio bytes:", Array.from(audioData.subarray(0, 4)));

    const userMessage = await convertAudioToText({ audioData });
    if (!userMessage?.trim()) {
      return res.status(500).send({ error: "STT failed (empty transcript)" });
    }

    let openAImessages = defaultResponse;
    try {
      openAImessages = await answerUniversal(userMessage);
    } catch (e) {
      console.error("❌ /sts answer error:", e);
    }

    const msgs =
      Array.isArray(openAImessages?.messages) && openAImessages.messages.length
        ? openAImessages.messages
        : defaultResponse?.messages || [];

    const jobId = crypto.randomUUID();

    let response;
    try {
      response = await lipSync({ messages: msgs, jobId });
    } catch (err) {
      console.error("🔥 /sts LIPSYNC CRASH:", err);
      return res.status(500).json({ error: "LipSync failed" });
    }

    const messages = response.map((m) => ({ id: crypto.randomUUID(), ...m }));
    res.send({ messages });
  } catch (err) {
    next(err);
  }
});

// ======================
// GLOBAL ERROR HANDLER
// (bitno: doda CORS i na error response)
// ======================
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);
  applyCorsHeaders(req, res);
  res.status(500).json({
    error: "Server error",
    message: err?.message || "Unknown error",
  });
});

// START
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});