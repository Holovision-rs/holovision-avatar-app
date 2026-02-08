import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import openai from "./openaiClient.js";
import { voice } from "./modules/elevenLabs.mjs";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ✅ osiguraj folder za audio output
fs.mkdirSync("audios", { recursive: true });

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// ✅ CORS (manual, stabilno)
const allowedOrigins = new Set([
  "https://holovision-avatar-app-1.onrender.com",
  "http://localhost:5173",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Preflight
  if (req.method === "OPTIONS") {
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    }
    return res.sendStatus(204);
  }

  // Normalni requesti
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  }

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

// Voices
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

// --- WEB ONLY ANSWER (simple) ---
const answerWithWebOnly = async (userMessage) => {
  console.log("🌐 [WEB ONLY] userMessage:", userMessage);

  const r = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    tools: [{ type: "web_search" }],
    input: userMessage,
  });

  const text = (r.output_text || "").trim();

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

// TTS
app.post("/tts", async (req, res) => {
  const userMessage = req.body.message;

  const defaultMessages = await sendDefaultMessages({ userMessage });
  if (defaultMessages) return res.send({ messages: defaultMessages });

  let openAImessages = defaultResponse;
  try {
    openAImessages = await answerWithWebOnly(userMessage);
  } catch (e) {
    console.error("❌ /tts web error:", e);
  }

  const response = await lipSync({ messages: openAImessages.messages || defaultResponse.messages });
  res.send({ messages: response });
});

// STS
app.post("/sts", async (req, res) => {
  try {
    let base64Audio = req.body?.audio;

    if (!base64Audio || typeof base64Audio !== "string") {
      return res.status(400).send({ error: "Missing audio (base64)" });
    }

    // Ako nekad dođe data URL
    if (base64Audio.startsWith("data:")) {
      base64Audio = base64Audio.split("base64,")[1] || "";
    }

    const audioData = Buffer.from(base64Audio, "base64");
    if (!audioData.length) return res.status(400).send({ error: "Decoded audio is empty" });

    console.log("audio bytes:", Array.from(audioData.subarray(0, 4)));

    const userMessage = await convertAudioToText({ audioData });
    if (!userMessage?.trim()) return res.status(500).send({ error: "STT failed (empty transcript)" });

    let openAImessages = defaultResponse;
    try {
      openAImessages = await answerWithWebOnly(userMessage);
    } catch (e) {
      console.error("❌ /sts web error:", e);
    }

    const response = await lipSync({ messages: openAImessages.messages || defaultResponse.messages });

    const messages = response.map((m) => ({ id: crypto.randomUUID(), ...m }));
    res.send({ messages });
  } catch (error) {
    console.error("Error in /sts:", error);
    res.status(500).send({ error: "Failed to process STT request." });
  }
});

// START
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});