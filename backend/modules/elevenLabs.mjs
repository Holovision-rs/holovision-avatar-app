import fs from "fs/promises";
import dotenv from "dotenv";
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

function makeWavFromPCM(pcmBuf, sampleRate = SAMPLE_RATE, channels = CHANNELS, bitsPerSample = BITS_PER_SAMPLE) {
  if (!Buffer.isBuffer(pcmBuf)) pcmBuf = Buffer.from(pcmBuf);

  // ✅ PCM16 mora biti paran broj bajtova
  if (bitsPerSample === 16 && (pcmBuf.length % 2) !== 0) {
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
  header.writeUInt16LE(1, 20);  // audio format 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuf]);
}

export async function convertTextToSpeech({ text, fileName }) {
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

  // ✅ sanity: ako je greška/tekst, uhvati odmah
  if (pcm.length < 64) {
    const maybeText = pcm.toString("utf8").slice(0, 200);
    throw new Error(`ElevenLabs returned too small payload: ${maybeText}`);
  }

  const wav = makeWavFromPCM(pcm);

  // ✅ sanity: WAV header
  if (wav.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Failed to build WAV (missing RIFF header)");
  }

  await fs.writeFile(fileName, wav);
  console.log("🎤 TTS generated (PCM->WAV):", fileName);

  return fileName;
}