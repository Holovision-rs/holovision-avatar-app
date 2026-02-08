console.log("OPENAI:", !!process.env.OPENAI_API_KEY);
console.log("MONGO:", !!process.env.MONGO_URI);
console.log("ELEVEN:", !!process.env.ELEVEN_LABS_API_KEY);
import { fileURLToPath } from "url";
import { dirname } from "path";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import openai from "./openaiClient.js";
import { voice } from "./modules/elevenLabs.mjs";

// MODULES
import { parser } from "./modules/openAI.mjs";
import { lipSync } from "./modules/lip-sync.mjs";
import { sendDefaultMessages, defaultResponse } from "./modules/defaultMessages.mjs";
import { convertAudioToText } from "./modules/whisper.mjs";

// ROUTES
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import fs from "fs";

fs.mkdirSync("audios", { recursive: true });

const allowedOrigins = [
  "https://holovision-avatar-app-1.onrender.com", // ✅ frontend
  "https://holovision-avatar-app-2.onrender.com", // ✅ backend (nije obavezno ali ok)
  "http://localhost:5173",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const app = express();

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.get("/healthz", (req, res) => res.status(200).send("ok"));
// CORS

app.use(
  cors({
    origin: (origin, callback) => {
      // dozvoli server-to-server, curl, postman (nema Origin header)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      // (opciono) dozvoli sve tvoje onrender subdomene:
      // if (origin.endsWith(".onrender.com")) return callback(null, true);

      return callback(null, false); // ❗ nemoj bacati Error, samo odbij
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ preflight za sve rute
app.options("*", cors());

// --- helpers ---
const extractJson = (raw = "") => {
  let s = raw.trim();

  // ukloni ```json ... ``` ili ``` ... ```
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-zA-Z]*\n?/, "");
    s = s.replace(/```$/, "");
    s = s.trim();
  }

  // uzmi samo deo od prve { do poslednje }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }

  return s;
};

const safeJsonParse = (s) => {
  // pokušaj normalno
  try {
    return JSON.parse(s);
  } catch {}

  // popravi raw newline/tab u stringovima
  let out = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

    if (escape) {
      out += ch;
      escape = false;
      continue;
    }

    if (ch === "\\") {
      out += ch;
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }

    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\r";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }

    out += ch;
  }

  return JSON.parse(out);
};

// --- WEB ONLY ANSWER (FOR TESTING) ---
const answerWithWebOnly = async (userMessage) => {
  const formatInstructions = parser.getFormatInstructions();

  console.log("🌐 [WEB ONLY] userMessage:", userMessage);

  const r = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content:
          "Return ONLY STRICT minified JSON (single line). No markdown fences. No commentary. No leading/trailing text. Do NOT include raw newlines inside strings; use \\n.",
      },
      {
        role: "user",
        content: `Question: ${userMessage}\n\n${formatInstructions}`,
      },
    ],
  });

  const raw = (r.output_text || "").trim();
  console.log("🌐 [WEB ONLY] raw:", raw.slice(0, 200));

  const cleaned = extractJson(raw);
  console.log("🌐 [WEB ONLY] cleaned:", cleaned.slice(0, 200));

  try {
    const parsed = safeJsonParse(cleaned);

    if (parsed?.messages?.length) return parsed;
    if (Array.isArray(parsed)) return { messages: parsed };

    throw new Error("Parsed JSON but missing messages");
  } catch (e) {
    console.error("❌ [WEB ONLY] JSON parse failed:", e);
    console.error("❌ [WEB ONLY] cleaned was:", cleaned);
    return defaultResponse;
  }
};

// MongoDB konekcija
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// API rute
app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);

// ElevenLabs API Key
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

// ROUTE: Dobavi glasove
app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

// ROUTE: TTS (WEB ONLY)
app.post("/tts", async (req, res) => {
  const userMessage = req.body.message;

  const defaultMessages = await sendDefaultMessages({ userMessage });
  if (defaultMessages) {
    res.send({ messages: defaultMessages });
    return;
  }

  let openAImessages;
  try {
    openAImessages = await answerWithWebOnly(userMessage);
  } catch (e) {
    console.error("❌ /tts web error:", e);
    openAImessages = defaultResponse;
  }

  const messagesForLipSync =
    Array.isArray(openAImessages?.messages) && openAImessages.messages.length
      ? openAImessages.messages
      : Array.isArray(defaultResponse?.messages)
      ? defaultResponse.messages
      : [];

  if (!messagesForLipSync.length) {
    return res.status(500).send({ error: "No messages for lipSync" });
  }

  const response = await lipSync({ messages: messagesForLipSync });
  res.send({ messages: response });
});

// ROUTE: STS (WEB ONLY)
app.post("/sts", async (req, res) => {
  try {
    let base64Audio = req.body?.audio;

    // ✅ 1) validacija
    if (!base64Audio || typeof base64Audio !== "string") {
      return res.status(400).send({ error: "Missing audio (base64)" });
    }

    // ✅ 2) ako neko pošalje data URL, očisti prefix
    if (base64Audio.startsWith("data:")) {
      base64Audio = base64Audio.split("base64,")[1] || "";
    }

    // ✅ 3) decode
    const audioData = Buffer.from(base64Audio, "base64");

    if (!audioData.length) {
      return res.status(400).send({ error: "Decoded audio is empty" });
    }

    // (opciono) debug prve bajtove da vidiš da li je webm
    console.log("audio bytes:", Array.from(audioData.subarray(0, 4)));

    const userMessage = await convertAudioToText({ audioData });

    if (!userMessage || !userMessage.trim()) {
      return res.status(500).send({ error: "STT failed (empty transcript)" });
    }

    let openAImessages;
    try {
      openAImessages = await answerWithWebOnly(userMessage);
    } catch (e) {
      console.error("❌ /sts web error:", e);
      openAImessages = defaultResponse;
    }

    const messagesForLipSync =
      Array.isArray(openAImessages?.messages) && openAImessages.messages.length
        ? openAImessages.messages
        : Array.isArray(defaultResponse?.messages)
        ? defaultResponse.messages
        : [];

    if (!messagesForLipSync.length) {
      return res.status(500).send({ error: "No messages for lipSync" });
    }

    const response = await lipSync({ messages: messagesForLipSync });

    const messages = response.map((m) => ({
      id: crypto.randomUUID(),
      ...m,
    }));

    res.send({ messages });
  } catch (error) {
    console.error("Error in /sts:", error);
    res.status(500).send({ error: "Failed to process STT request." });
  }
});

// START SERVER
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});