import fs from "fs/promises";
import dotenv from "dotenv";
dotenv.config();

const elevenKey = process.env.ELEVEN_LABS_API_KEY;
const voiceId = process.env.ELEVEN_LABS_VOICE_ID;
const modelId = process.env.ELEVEN_LABS_MODEL_ID || "eleven_multilingual_v2";

// ✅ WAV radi SAMO na non-streaming endpointu
const OUTPUT_FORMAT = "wav_16000";

// (opciono) limit da TTS ne razvlači
const MAX_CHARS = 450;

export async function convertTextToSpeech({ text, fileName }) {
  if (!elevenKey) throw new Error("Missing ELEVEN_LABS_API_KEY");
  if (!voiceId) throw new Error("Missing ELEVEN_LABS_VOICE_ID");

  const safeText = (text || "").trim().slice(0, MAX_CHARS);

  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}` +
    `?output_format=${encodeURIComponent(OUTPUT_FORMAT)}`;

  // ✅ timeout da Eleven ne blokira server
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey,
        "Content-Type": "application/json",
        Accept: "audio/wav",
      },
      body: JSON.stringify({
        text: safeText,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.7,
          style: 0.7,
          use_speaker_boost: true,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const isAbort =
      err?.name === "AbortError" || err?.code === "ABORT_ERR";
    if (isAbort) throw new Error("ElevenLabs timeout (12s)");
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${t}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());

  // ✅ sanity check: WAV header "RIFF"
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF") {
    // ako je ovo JSON greška, videćeš je ovde
    const maybeText = buf.toString("utf8").slice(0, 200);
    throw new Error(`ElevenLabs returned non-WAV data: ${maybeText}`);
  }

  await fs.writeFile(fileName, buf);
  console.log("🎤 TTS generated (WAV):", fileName);

  return fileName;
}