import { convertTextToSpeech } from "./elevenLabs.mjs";
import { getPhonemes } from "./rhubarbLipSync.mjs";
import { readJsonTranscript, audioFileToBase64 } from "../utils/files.mjs";
import fs from "fs/promises";

const MAX_RETRIES = 6;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (attempt) => Math.min(2000, 200 * Math.pow(2, attempt)); // 200,400,800,1600,2000...

export const lipSync = async ({ messages, jobId }) => {
  const t0 = Date.now();

  // ✅ uvek osiguraj folder
  await fs.mkdir("audios", { recursive: true });

  // ✅ per-request prefix (bez sudaranja fajlova)
  const prefix = jobId || `job_${Date.now()}`;

  // 1) TTS -> WAV (paralelno)
  await Promise.all(
    messages.map(async (message, index) => {
      const fileName = `audios/${prefix}_message_${index}.wav`;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await convertTextToSpeech({ text: message.text, fileName });
          console.log(`🎤 TTS OK [${prefix}] msg=${index}`);
          return;
        } catch (error) {
          const status = error?.response?.status || error?.status;
          if (status === 429 && attempt < MAX_RETRIES - 1) {
            await delay(backoffMs(attempt));
            continue;
          }
          console.error(`❌ TTS FAIL [${prefix}] msg=${index}`, error?.message || error);
          throw error;
        }
      }
    })
  );

  // 2) Rhubarb -> JSON + base64 (SEKVENCijalno)
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];

    const wav = `audios/${prefix}_message_${index}.wav`;
    const json = `audios/${prefix}_message_${index}.json`;

    try {
      await getPhonemes({ inputWav: wav, outputJson: json });

      message.audio = await audioFileToBase64({ fileName: wav });
      message.lipsync = await readJsonTranscript({ fileName: json });

      console.log(`🗣️ RHUBARB OK [${prefix}] msg=${index}`);
    } catch (err) {
      console.error(`❌ RHUBARB FAIL [${prefix}] msg=${index}`, err?.message || err);

      // ✅ minimalan fallback da ne ubije ceo request
      message.audio = message.audio || null;
      message.lipsync = message.lipsync || null;
    }
  }

  console.log(`✅ lipSync DONE [${prefix}] in ${Date.now() - t0}ms`);
  return messages;
};