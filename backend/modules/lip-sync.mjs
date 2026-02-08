import { convertTextToSpeech } from "./elevenLabs.mjs";
import { getPhonemes } from "./rhubarbLipSync.mjs";
import { readJsonTranscript, audioFileToBase64 } from "../utils/files.mjs";
import fs from "fs/promises";
import crypto from "crypto";

const MAX_RETRIES = 6;
const CLEANUP_FILES = true; // ✅ na Renderu preporuka: true

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (attempt) => Math.min(2000, 200 * Math.pow(2, attempt)); // 200,400,800,1600,2000...

const safePrefix = (s) =>
  String(s || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);

const tryUnlink = async (p) => {
  try {
    await fs.unlink(p);
  } catch {}
};

export const lipSync = async ({ messages, jobId }) => {
  const t0 = Date.now();

  if (!Array.isArray(messages) || !messages.length) return [];

  // ✅ folder uvek postoji
  await fs.mkdir("audios", { recursive: true });

  // ✅ prefix bez sudara
  const prefix = safePrefix(jobId) || `job_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

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
  //    (SEKVENCijalno - CPU heavy)
  // ==========================================
  const tRh = Date.now();

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];

    const wavPath = `audios/${prefix}_message_${index}.wav`;
    const jsonPath = `audios/${prefix}_message_${index}.json`;

    // ✅ audio uvek pokušaj prvo (da avatar bar priča)
    try {
      message.audio = await audioFileToBase64({ fileName: wavPath });
    } catch (e) {
      console.error(`❌ AUDIO->BASE64 FAIL [${prefix}] msg=${index}`, e?.message || e);
      message.audio = null;
    }

    try {
      await getPhonemes({ inputWav: wavPath, outputJson: jsonPath });
      message.lipsync = await readJsonTranscript({ fileName: jsonPath });
      console.log(`🗣️ RHUBARB OK [${prefix}] msg=${index}`);
    } catch (e) {
      // ✅ ne ubij request; samo lipsync null
      console.error(`❌ RHUBARB FAIL [${prefix}] msg=${index}`, e?.message || e);
      message.lipsync = null;
    }

    // ✅ cleanup po poruci (da ne puni disk)
    if (CLEANUP_FILES) {
      await Promise.allSettled([tryUnlink(wavPath), tryUnlink(jsonPath)]);
    }
  }

  console.log(`🗣️ RHUBARB LOOP DONE [${prefix}] in ${Date.now() - tRh}ms`);
  console.log(`✅ lipSync DONE [${prefix}] total ${Date.now() - t0}ms`);

  return messages;
};