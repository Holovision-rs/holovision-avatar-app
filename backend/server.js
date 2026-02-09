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

process.on("uncaughtException", (err) => console.error("🔥 UNCAUGHT EXCEPTION:", err));
process.on("unhandledRejection", (err) => console.error("🔥 UNHANDLED REJECTION:", err));

const app = express();

// (opciono) ako Render proxy pravi probleme
app.set("trust proxy", 1);

// ✅ osiguraj folder (ako ga i dalje negde koristiš)
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
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    // ✅ KLJUČNO: PATCH
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    // (opciono) cache preflight
    res.setHeader("Access-Control-Max-Age", "600");
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

// ======================
// LIPSYNC STORE (in-memory)
// ======================
const lipsyncStore = new Map();
const storeKey = (jobId, index) => `${jobId}:${index}`;

const setLipsyncPending = (jobId, index) => {
  lipsyncStore.set(storeKey(jobId, index), {
    status: "pending",
    lipsync: null,
    error: null,
    updatedAt: Date.now(),
  });
};

const setLipsyncReady = (jobId, index, lip) => {
  lipsyncStore.set(storeKey(jobId, index), {
    status: "ready",
    lipsync: lip,
    error: null,
    updatedAt: Date.now(),
  });
};

const setLipsyncError = (jobId, index, e) => {
  lipsyncStore.set(storeKey(jobId, index), {
    status: "error",
    lipsync: null,
    error: e?.message || String(e),
    updatedAt: Date.now(),
  });
};

// ✅ cleanup store (na 10 min)
const LIPSYNC_TTL_MS = 10 * 60 * 1000;
const tCleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of lipsyncStore.entries()) {
    if (!v?.updatedAt || now - v.updatedAt > LIPSYNC_TTL_MS) lipsyncStore.delete(k);
  }
}, 60 * 1000);
tCleanup.unref?.();

// ✅ polling endpoint
app.get("/lipsync/:jobId/:index", (req, res) => {
  const { jobId, index } = req.params;
  const v = lipsyncStore.get(storeKey(jobId, Number(index)));

  if (!v) return res.status(404).json({ status: "missing", ready: false });

  res.json({
    status: v.status,
    ready: v.status === "ready",
    lipsync: v.lipsync,
    error: v.error,
    updatedAt: v.updatedAt,
  });
});

// ======================
// LANGUAGE + TRANSCRIPT GUARDS
// ======================
const detectLang = (text = "") => {
  const t = (text || "").toLowerCase();
  if (/[\u0400-\u04FF]/.test(text) || /[čćžšđ]/.test(t)) return "sr";

  const enHits = ["what", "who", "how", "price", "today", "now", "hello", "please"].filter((w) =>
    t.includes(w)
  ).length;

  if (enHits >= 2) return "en";
  return "sr";
};

const isBadTranscript = (text = "") => {
  const t = (text || "").trim();
  if (t.length < 3) return true;
  const letters = (t.match(/[a-zA-Z\u0400-\u04FFčćžšđČĆŽŠĐ]/g) || []).length;
  if (letters < 2) return true;
  if (/^(mmm+|aaa+|eee+|uh+|um+|caucity)$/i.test(t)) return true;
  return false;
};

const notUnderstood = (lang = "sr") => ({
  messages: [
    {
      text:
        lang === "en"
          ? "Sorry — I didn’t catch that. Can you repeat more clearly?"
          : "Izvini — nisam razumeo. Možeš da ponoviš malo jasnije?",
      facialExpression: "sad",
      animation: "Idle",
    },
  ],
});

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// API rute
app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);

// ======================
// /voices (ElevenLabs)
// ======================
app.get("/voices", async (req, res) => {
  try {
    const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!elevenLabsApiKey) return res.status(400).json({ error: "Missing ELEVEN_LABS_API_KEY" });

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);

    const r = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": elevenLabsApiKey },
      signal: controller.signal,
    }).finally(() => clearTimeout(t));

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return res.status(r.status).json({ error: "ElevenLabs voices failed", details: txt });
    }

    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error("🔥 Voices route error:", e);
    res.status(500).json({ error: "Voices error", message: e?.message || String(e) });
  }
});

// ======================
// AVATAR GUARDIAN LAYER
// ======================
const GUARD = {
  name: "Torin",
  brand: "HOLOVISION",
  maxWebMs: 10000,
  bannedPhrases: ["openai", "chatgpt", "gpt"],
};

const normalize = (s = "") => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

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
          text: `Ja sam ${GUARD.name} — AI virtualni asistent ${GUARD.brand}-a. Tu sam da pomognem oko informacija, objašnjenja i zadataka.`,
          facialExpression: "smile",
          animation: "TalkingTwo",
        },
      ],
    },
  },
  {
    id: "brand_holovision_micro",
    triggers: ["šta je holovision", "sta je holovision", "what is holovision", "tell me about holovision", "ko je holovision"],
    reply: {
      messages: [
        {
          text: `HOLOVISION je kompanija koja pomera granice vizuelne komunikacije koristeći hologramsku tehnologiju nove generacije.

Specijalizovani smo za realistične 3D holograme, digitalne avatare i interaktivne prezentacije koje privlače pažnju i stvaraju iskustva koja se pamte.

Više informacija: holovision.rs`,
          facialExpression: "smile",
          animation: "TalkingOne",
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

const WEB_KEYWORDS = ["danas","trenutno","sad","najnovije","vesti","cena","kurs","link","price","today","now","latest","news","rate"];
const shouldUseWeb = (q = "") => WEB_KEYWORDS.some((k) => normalize(q).includes(normalize(k)));

const sanitizeAssistantText = (text = "") => {
  const lower = (text || "").toLowerCase();
  if (GUARD.bannedPhrases.some((p) => lower.includes(p))) {
    return `Ja sam ${GUARD.name}, AI avatar ${GUARD.brand}-a. Kako mogu da pomognem?`;
  }
  return text || "";
};

const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT_${ms}ms`)), ms)),
  ]);

const systemForLang = (lang) => {
  if (lang === "en") {
    return `You are ${GUARD.name}, a professional AI avatar for ${GUARD.brand}.
Answer ONLY in English. Keep it short and clear (1-2 sentences).`;
  }
  return `Ti si ${GUARD.name}, profesionalni AI avatar za ${GUARD.brand}.
Odgovaraj ISKLJUČIVO na srpskom. Kratko i jasno (1-2 rečenice).`;
};

const answerFastNoWeb = async (userMessage, lang) => {
  const r = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input: [
      { role: "system", content: systemForLang(lang) },
      { role: "user", content: userMessage },
    ],
  });

  const text = sanitizeAssistantText((r.output_text || "").trim());

  return {
    messages: [
      {
        text: text || (lang === "en" ? "I can’t answer that right now." : "Ne mogu trenutno da pronađem odgovor."),
        facialExpression: "default",
        animation: "Idle",
      },
    ],
  };
};

const answerWeb = async (userMessage, lang) => {
  const r = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    tools: [{ type: "web_search" }],
    input: [
      { role: "system", content: systemForLang(lang) + " Use the web only when necessary." },
      { role: "user", content: userMessage },
    ],
  });

  const text = sanitizeAssistantText((r.output_text || "").trim());

  // ✅ DETEKCIJA — da li je web tool stvarno korišćen
  const usedWeb = Array.isArray(r.output) &&
    r.output.some(
      (o) =>
        o?.type === "tool_call" ||
        o?.type === "web_search" ||
        o?.name === "web_search"
    );

  const fallback =
    lang === "en"
      ? "I can’t find that right now."
      : "Ne mogu trenutno da pronađem odgovor.";

  return {
    messages: [
      {
        text: text || fallback,
        facialExpression: "default",
        animation: "Idle",

        // ✅ RATE samo ako je WEB stvarno korišćen
        ...(usedWeb ? { ttsRate: 0.82 } : {}),
      },
    ],
  };
};

const answerUniversal = async (userMessage) => {
  console.log("🧠 question:", userMessage);

  const lang = detectLang(userMessage);
  const hard = matchHardIntent(userMessage);
  if (hard) return hard;

  if (!shouldUseWeb(userMessage)) {
    console.log("⚡ FAST (no web)");
    return await answerFastNoWeb(userMessage, lang);
  }

  console.log(`🌐 WEB (max ${GUARD.maxWebMs}ms)...`);
  try {
    return await withTimeout(answerWeb(userMessage, lang), GUARD.maxWebMs);
  } catch (e) {
    console.warn("🌐 Web timeout/fail -> FAST fallback:", e?.message || e);
    return await answerFastNoWeb(userMessage, lang);
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

    const response = await lipSync({
      messages: msgs,
      jobId,
      hooks: {
        onPending: (jid, idx) => setLipsyncPending(jid, idx),
        onReady: (jid, idx, lip) => setLipsyncReady(jid, idx, lip),
        onError: (jid, idx, e) => setLipsyncError(jid, idx, e),
      },
    });

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
    const lang = detectLang(userMessage || "");

    if (!userMessage?.trim() || isBadTranscript(userMessage)) {
      const jobId = crypto.randomUUID();
      const fallback = notUnderstood(lang);

      const out = await lipSync({
        messages: fallback.messages,
        jobId,
        hooks: {
          onPending: (jid, idx) => setLipsyncPending(jid, idx),
          onReady: (jid, idx, lip) => setLipsyncReady(jid, idx, lip),
          onError: (jid, idx, e) => setLipsyncError(jid, idx, e),
        },
      });

      return res.send({ messages: out.map((m) => ({ id: crypto.randomUUID(), ...m })) });
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

    const response = await lipSync({
      messages: msgs,
      jobId,
      hooks: {
        onPending: (jid, idx) => setLipsyncPending(jid, idx),
        onReady: (jid, idx, lip) => setLipsyncReady(jid, idx, lip),
        onError: (jid, idx, e) => setLipsyncError(jid, idx, e),
      },
    });

    const messages = response.map((m) => ({ id: crypto.randomUUID(), ...m }));
    res.send({ messages });
  } catch (err) {
    next(err);
  }
});

// ======================
// GLOBAL ERROR HANDLER
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