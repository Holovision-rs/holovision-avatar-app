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

// ======================
// LANGUAGE + TRANSCRIPT GUARDS
// ======================
const detectLang = (text = "") => {
  const t = (text || "").toLowerCase();

  // ćirilica ili sr slova -> sr
  if (/[\u0400-\u04FF]/.test(text) || /[čćžšđ]/.test(t)) return "sr";

  // basic en signal
  const enHits = ["what", "who", "how", "price", "today", "now", "hello", "please"].filter((w) =>
    t.includes(w)
  ).length;

  if (enHits >= 2) return "en";

  return "sr"; // default
};

const isBadTranscript = (text = "") => {
  const t = (text || "").trim();
  if (t.length < 3) return true;

  const letters = (t.match(/[a-zA-Z\u0400-\u04FFčćžšđČĆŽŠĐ]/g) || []).length;
  if (letters < 2) return true;

  // tipični “glupi” transkripti / šum
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
// /voices (ElevenLabs)  ✅
/** ostaje kako radi, samo je ovde */
app.get("/voices", async (req, res) => {
  try {
    const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

    if (!elevenLabsApiKey) {
      return res.status(400).json({ error: "Missing ELEVEN_LABS_API_KEY" });
    }

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
          text: `Ja sam ${GUARD.name} — AI virtualni asistent ${GUARD.brand}-a. Tu sam da pomognem oko informacija, objašnjenja i zadataka.`,
          facialExpression: "smile",
          animation: "TalkingTwo",
        },
      ],
    },
  },
  {
    id: "brand_holovision_micro",
    triggers: [
      "šta je holovision",
      "sta je holovision",
      "what is holovision",
      "tell me about holovision",
      "ko je holovision",
    ],
    reply: {
      messages: [
        {
          text: `HOLOVISION je pionir nove generacije hologramske komunikacije.

  Kreiramo realistične 3D holograme i digitalne avatare koji pretvaraju svaku prezentaciju u nezaboravno iskustvo.

  Saznajte više na holovision.rs`,
          facialExpression: "smile",
          animation: "TalkingOne",
        },
      ],
    },
  },
  {
    id: "brand_holovision_standard",
    triggers: [
      "čime se bavite",
      "cime se bavite",
      "šta radite",
      "sta radite",
      "what do you do",
      "services",
      "usluge",
    ],
    reply: {
      messages: [
        {
          text: `HOLOVISION razvija napredna hologramska rešenja za marketing, događaje i savremene prodajne prostore.

  Naša tehnologija omogućava brendovima da privuku pažnju, povećaju angažovanje i ostave snažan vizuelni utisak.

  Posetite holovision.rs i otkrijte kako budućnost komunikacije izgleda danas.`,
          facialExpression: "default",
          animation: "TalkingTwo",
        },
      ],
    },
  },
  {
    id: "brand_holovision_deep",
    triggers: [
      "gde mogu da kupim",
      "kontakt",
      "how can we work together",
      "price",
      "saradnja",
      "ponuda",
    ],
    reply: {
      messages: [
        {
          text: `HOLOVISION pruža kompletna hologramska rešenja — od ideje i 3D produkcije do implementacije i podrške.

  Naš tim pomaže kompanijama da se izdvoje kroz inovativna vizuelna iskustva koja publika pamti.

  Kontaktirajte nas putem sajta holovision.rs i započnimo kreiranje vaše hologramske prezentacije.`,
          facialExpression: "smile",
          animation: "TalkingThree",
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
          facialExpression: "smile",
          animation: "TalkingThree",
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
          text: `${GUARD.brand} tim me je razvio kao AI virtualnog asistenta.`,
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
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT_${ms}ms`)), ms)),
  ]);

// ✅ jezički “lock”
const systemForLang = (lang) => {
  if (lang === "en") {
    return `You are ${GUARD.name}, a professional AI avatar for ${GUARD.brand}.
Answer ONLY in English. Keep it short and clear (1-2 sentences).
If unclear, ask ONE short follow-up question.
Never say you are ChatGPT or OpenAI.`;
  }
  return `Ti si ${GUARD.name}, profesionalni AI avatar za ${GUARD.brand}.
Odgovaraj ISKLJUČIVO na srpskom. Kratko i jasno (1-2 rečenice).
Ako je nejasno, postavi JEDNO kratko potpitanje.
Nikada ne reci da si ChatGPT ili OpenAI.`;
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

  return {
    messages: [
      {
        text: text || (lang === "en" ? "I can’t find that right now." : "Ne mogu trenutno da pronađem odgovor."),
        facialExpression: "default",
        animation: "Idle",
      },
    ],
  };
};

// ✅ UNIVERSAL: hard intent -> fast -> web<=10s -> fallback fast
const answerUniversal = async (userMessage) => {
  console.log("🧠 question:", userMessage);

  const lang = detectLang(userMessage);

  const hard = matchHardIntent(userMessage);
  if (hard) {
    // ako je hard intent, samo uskladi jezik ako je EN
    if (lang === "en") {
      // minimalno: prevedi hard intent u EN za identity_name/creator/who
      // (da ne menjaš strukturu, samo override text)
      const txt = hard?.messages?.[0]?.text || "";
      return {
        messages: [
          {
            ...hard.messages[0],
            text:
              /Ja sam/.test(txt) || /tim me je razvio/.test(txt)
                ? "I’m Torin, HOLOVISION’s AI avatar assistant."
                : "I’m Torin — HOLOVISION’s AI avatar assistant. How can I help?",
          },
        ],
      };
    }
    return hard;
  }

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
    const lang = detectLang(userMessage || "");

    // ✅ ako je transkript šum -> NE ide u AI, nego traži ponavljanje
    if (!userMessage?.trim() || isBadTranscript(userMessage)) {
      return res.send({ messages: await lipSync({ messages: notUnderstood(lang).messages, jobId: crypto.randomUUID() }) });
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