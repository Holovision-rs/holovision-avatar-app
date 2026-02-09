import fs from "fs/promises";
import dotenv from "dotenv";
import { exec } from "child_process";

dotenv.config();

const elevenKey = process.env.ELEVEN_LABS_API_KEY;
const voiceId = process.env.ELEVEN_LABS_VOICE_ID;
const modelId = process.env.ELEVEN_LABS_MODEL_ID || "eleven_multilingual_v2";

// ✅ STREAM endpoint + PCM -> mi pravimo WAV
const OUTPUT_FORMAT = "pcm_16000";
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

// (opciono) limit da TTS ne razvlači
const MAX_CHARS = 350;

// ---- exec helper (sa timeoutom)
const execCommand = (command, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve({ stdout, stderr });
    });
  });

// ---- WAV builder
function makeWavFromPCM(
  pcmBuf,
  sampleRate = SAMPLE_RATE,
  channels = CHANNELS,
  bitsPerSample = BITS_PER_SAMPLE
) {
  if (!Buffer.isBuffer(pcmBuf)) pcmBuf = Buffer.from(pcmBuf);

  // ✅ PCM16 mora biti paran broj bajtova
  if (bitsPerSample === 16 && pcmBuf.length % 2 !== 0) {
    pcmBuf = pcmBuf.subarray(0, pcmBuf.length - 1);
  }

  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcmBuf.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, 4, "ascii");

  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuf]);
}

// ✅ SoX time-stretch bez pitch-a (tempo)
// ttsRate: 0.5 => 2x sporije (50% brzine)
// ttsRate: 1.0 => normalno
async function timeStretchWithSox({ inputWav, ttsRate, timeoutMs = 20000 }) {
  const r = Number(ttsRate);
  if (!Number.isFinite(r) || r <= 0 || r === 1) return inputWav;

  // SoX tempo radi ok u ~0.5..2.0 (ispod 0.5 zna da zvuči loše)
  const factor = Math.max(0.5, Math.min(2.0, r));

  // probaj sox --version (ako nema, ne puca)
  try {
    await execCommand("sox --version", 4000);
  } catch {
    console.warn("⚠️ sox nije dostupan na serveru. Preskačem time-stretch.");
    return inputWav;
  }

  const out = inputWav.replace(/\.wav$/i, "") + `_tempo_${String(factor).replace(".", "_")}.wav`;

  // -q quiet, tempo -s = kvalitetnije
  const cmd = `sox -q "${inputWav}" "${out}" tempo -s ${factor}`;
  await execCommand(cmd, timeoutMs);

  // sanity
  const st = await fs.stat(out).catch(() => null);
  if (!st || st.size < 128) {
    console.warn("⚠️ sox output izgleda loše, vraćam original");
    return inputWav;
  }

  // zameni original sadržajem (da ostatak koda koristi fileName kao i pre)
  const data = await fs.readFile(out);
  await fs.writeFile(inputWav, data);
  await fs.unlink(out).catch(() => {});

  console.log(`🐢 SoX tempo applied: ttsRate=${factor} (no pitch)`);
  return inputWav;
}

export async function convertTextToSpeech({ text, fileName, ttsRate = 1.0 }) {
  if (!elevenKey) throw new Error("Missing ELEVEN_LABS_API_KEY");
  if (!voiceId) throw new Error("Missing ELEVEN_LABS_VOICE_ID");

  const safeText = (text || "").trim().slice(0, MAX_CHARS);

  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream` +
    `?output_format=${encodeURIComponent(OUTPUT_FORMAT)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey,
        "Content-Type": "application/json",
        Accept: "application/octet-stream",
      },
      body: JSON.stringify({
        text: safeText,
        model_id: modelId,
        optimize_streaming_latency: 3,
        voice_settings: {
          stability: 0.5,
          style: 0.7,
          similarity_boost: 0.7,
          use_speaker_boost: true,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw new Error("ElevenLabs timeout (12s)");
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${t}`);
  }

  const pcm = Buffer.from(await res.arrayBuffer());

  if (pcm.length < 64) {
    const maybeText = pcm.toString("utf8").slice(0, 200);
    throw new Error(`ElevenLabs returned too small payload: ${maybeText}`);
  }

  const wav = makeWavFromPCM(pcm);
  if (wav.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Failed to build WAV (missing RIFF header)");
  }

  // 1) snimi WAV
  await fs.writeFile(fileName, wav);

  // 2) uspori/ubrzaj bez pitch-a (samo ako treba)
  await timeStretchWithSox({ inputWav: fileName, ttsRate });

  console.log("🎤 TTS WAV ready:", fileName);
  return fileName;
}