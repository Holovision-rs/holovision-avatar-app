import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";

import { openAIChain, parser } from "./modules/openAI.mjs";
import { lipSync } from "./modules/lip-sync.mjs";
import { sendDefaultMessages, defaultResponse } from "./modules/defaultMessages.mjs";
import { convertAudioToText } from "./modules/whisper.mjs";

import userRoutes from "./routes/userRoutes.js";

dotenv.config();
const app = express();

// CORS
const allowedOrigins = [
  "https://holovision-avatar-app-1.onrender.com", // zameni sa tvojim frontend URL-om
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// MongoDB konekcija
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// User rute
app.use("/api", userRoutes);

// ElevenLabs API Key
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

// ROUTE: Dobavi glasove
app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

// ROUTE: TTS
app.post("/tts", async (req, res) => {
  const userMessage = req.body.message;
  const defaultMessages = await sendDefaultMessages({ userMessage });

  if (defaultMessages) {
    res.send({ messages: defaultMessages });
    return;
  }

  let openAImessages;
  try {
    openAImessages = await openAIChain.invoke({
      question: userMessage,
      format_instructions: parser.getFormatInstructions(),
    });
  } catch (error) {
    openAImessages = defaultResponse;
  }

  const response = await lipSync({ messages: openAImessages.messages });
  res.send({ messages: response });
});

// ROUTE: STS
app.post("/sts", async (req, res) => {
  try {
    const base64Audio = req.body.audio;
    const audioData = Buffer.from(base64Audio, "base64");
    const userMessage = await convertAudioToText({ audioData });

    let openAImessages;
    try {
      openAImessages = await openAIChain.invoke({
        question: userMessage,
        format_instructions: parser.getFormatInstructions(),
      });
    } catch (error) {
      openAImessages = defaultResponse;
    }

    const response = await lipSync({ messages: openAImessages.messages });
    res.send({ messages: response });
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