import { convertTextToSpeech } from "./elevenLabs.mjs";
import { getPhonemes } from "./rhubarbLipSync.mjs";
import { readJsonTranscript, audioFileToBase64 } from "../utils/files.mjs";
import fs from "fs/promises";
import crypto from "crypto";
import os from "os";

const MAX_RETRIES = 6;
const CLEANUP_FILES = true;

const AUDIO_B64_TIMEOUT_MS = 6000; // ✅ zaštita: da ne može da blokira response
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (attempt) => Math.min(2000, 200 * Math.pow(2, attempt));

const safePrefix = (s) =>
  String(s || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);

const tryUnlink = async (p) => {
  try {
    await fs.unlink(p);
  } catch {}
};

// ✅ osiguraj data URL prefix za WAV
const ensureWavDataUrl = (b64) => {
  if (!b64) return null;
  if (b64.startsWith("data:")) return b64;
  return `data:audio/wav;base64,${b64}`;
};

const withTimeout = (promise, ms, label = "TIMEOUT") =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_${ms}ms`)), ms)),
  ]);

// ✅ ASYNC lipsync: vrati odmah audio, a rhubarb u pozadini
export const lipSync = async ({ messages, jobId, hooks }) => {
  const t0 = Date.now();
  if (!Array.isArray(messages) || !messages.length) return [];

  const prefix =
    safePrefix(jobId) || `job_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const TMP = os.tmpdir(); // ✅ /tmp na Renderu je najbrže

  // =========================
  // 1) TTS -> WAV (paralelno)
  // =========================
  const tTts = Date.now();

  await Promise.all(
    messages.map(async (message, index) => {
      const wavPath = `${TMP}/${prefix}_message_${index}.wav`;

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
  // 2) Odmah ubaci audio + meta za polling
  //    (OVO mora biti brzo!)
  // ==========================================
  for (let index = 0; index < messages.length; index++) {
    // signal pending u store što ranije
    hooks?.onPending?.(jobId, index);

    const wavPath = `${TMP}/${prefix}_message_${index}.wav`;

    try {
      const b64 = await withTimeout(
        audioFileToBase64({ fileName: wavPath }),
        AUDIO_B64_TIMEOUT_MS,
        "AUDIO_B64_TIMEOUT"
      );
      messages[index].audio = ensureWavDataUrl(b64);
    } catch (e) {
      console.error(`❌ AUDIO->BASE64 FAIL [${prefix}] msg=${index}`, e?.message || e);
      messages[index].audio = null;
    }

    // ✅ stavi polling meta
    messages[index].lipsync = null;
    messages[index].lipsyncJobId = jobId;
    messages[index].lipsyncIndex = index;
  }

  // ==========================================
  // 3) Rhubarb u pozadini (NE BLOKIRA RESPONSE)
  // ==========================================
  setImmediate(() => {
    (async () => {
      const tRh = Date.now();

      for (let index = 0; index < messages.length; index++) {
        const wavPath = `${TMP}/${prefix}_message_${index}.wav`;
        const jsonPath = `${TMP}/${prefix}_message_${index}.json`;

        try {
          const tOne = Date.now();

          await getPhonemes({ inputWav: wavPath, outputJson: jsonPath });
          const lip = await readJsonTranscript({ fileName: jsonPath });

          if (!lip?.mouthCues || !Array.isArray(lip.mouthCues) || lip.mouthCues.length === 0) {
            throw new Error("Invalid lipsync JSON (missing mouthCues)");
          }

          console.log(
            `🗣️ RHUBARB OK [${prefix}] msg=${index} cues=${lip.mouthCues.length} in ${Date.now() - tOne}ms`
          );

          hooks?.onReady?.(jobId, index, lip);
        } catch (e) {
          console.error(`❌ RHUBARB FAIL [${prefix}] msg=${index}`, e?.message || e);
          hooks?.onError?.(jobId, index, e);
        } finally {
          if (CLEANUP_FILES) {
            await Promise.allSettled([tryUnlink(wavPath), tryUnlink(jsonPath)]);
          }
        }
      }

      console.log(`✅ ASYNC RHUBARB DONE [${prefix}] in ${Date.now() - tRh}ms`);
    })().catch((e) => {
      // ⛑️ nikad ne daj da async deo sruši process
      console.error("🔥 ASYNC RHUBARB FATAL:", e?.message || e);
    });
  });

  console.log(`✅ lipSync FAST RETURN [${prefix}] total ${Date.now() - t0}ms`);
  return messages;
};