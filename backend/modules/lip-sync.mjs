import { convertTextToSpeech } from "./elevenLabs.mjs";
import { getPhonemes } from "./rhubarbLipSync.mjs";
import { readJsonTranscript, audioFileToBase64 } from "../utils/files.mjs";
import fs from "fs/promises";
import crypto from "crypto";

const MAX_RETRIES = 6;
const CLEANUP_FILES = true;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (attempt) => Math.min(2000, 200 * Math.pow(2, attempt));

const safePrefix = (s) =>
  String(s || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);

const tryUnlink = async (p) => {
  try {
    await fs.unlink(p);
  } catch {}
};

// ✅ osiguraj data URL prefix za WAV (frontend često očekuje ovo)
const ensureWavDataUrl = (b64) => {
  if (!b64) return null;
  if (b64.startsWith("data:")) return b64;
  return `data:audio/wav;base64,${b64}`;
};

export const lipSync = async ({ messages, jobId }) => {
  const t0 = Date.now();
  if (!Array.isArray(messages) || !messages.length) return [];

  await fs.mkdir("audios", { recursive: true });

  const prefix =
    safePrefix(jobId) || `job_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // =========================
  // 1) TTS -> WAV (paralelno)
  // =========================
  const tTts = Date.now();

  await Promise.all(
    messages.map(async (message, index) => {
      const wavPath = `audios/${prefix}_message_${index}.wav`;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await convertTextToSpeech({ text: message.text, fileName: wavPath });
          return;
        } catch (error) {
          const status = error?.response?.status || error?.status;
          if (status === 429 && attempt < MAX_RETRIES - 1) {
            await delay(backoffMs(attempt));
            continue;
          }
          throw error;
        }
      }
    })
  );

  console.log(`🎤 TTS DONE [${prefix}] in ${Date.now() - tTts}ms`);

  // ==========================================
  // 2) Rhubarb -> JSON + attach audio/lipsync
  // ==========================================
  const tRh = Date.now();

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    const wavPath = `audios/${prefix}_message_${index}.wav`;
    const jsonPath = `audios/${prefix}_message_${index}.json`;

    // ✅ audio prvo (da bar priča i kad lipsync fail)
    try {
      const b64 = await audioFileToBase64({ fileName: wavPath });
      message.audio = ensureWavDataUrl(b64);
    } catch (e) {
      console.error(`❌ AUDIO->BASE64 FAIL [${prefix}] msg=${index}`, e?.message || e);
      message.audio = null;
    }

    // ✅ lipsync (Rhubarb)
    try {
      await getPhonemes({ inputWav: wavPath, outputJson: jsonPath });

      const lip = await readJsonTranscript({ fileName: jsonPath });
      console.log("🧾 mouthCues sample:", lip?.mouthCues?.slice(0, 10));
      // ✅ obavezno mora da ima mouthCues
      if (!lip?.mouthCues || !Array.isArray(lip.mouthCues) || lip.mouthCues.length === 0) {
        throw new Error("Invalid lipsync JSON (missing mouthCues)");
      }

      message.lipsync = lip;

      console.log(
        `🗣️ RHUBARB OK [${prefix}] msg=${index} cues=${lip.mouthCues.length}`
      );
    } catch (e) {
      console.error(`❌ RHUBARB FAIL [${prefix}] msg=${index}`, e?.message || e);

      // ✅ NE ubij request – samo nema lipsync, ali audio radi
      message.lipsync = null;
    }

    if (CLEANUP_FILES) {
      await Promise.allSettled([tryUnlink(wavPath), tryUnlink(jsonPath)]);
    }
  }

  console.log(`🗣️ RHUBARB LOOP DONE [${prefix}] in ${Date.now() - tRh}ms`);
  console.log(`✅ lipSync DONE [${prefix}] total ${Date.now() - t0}ms`);

  return messages;
};