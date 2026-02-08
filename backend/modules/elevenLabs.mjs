import fs from "fs/promises";
import dotenv from "dotenv";
dotenv.config();

const elevenKey = process.env.ELEVEN_LABS_API_KEY;
const voiceId = process.env.ELEVEN_LABS_VOICE_ID;
const modelId = process.env.ELEVEN_LABS_MODEL_ID || "eleven_multilingual_v2";

// 🔥 WAV direktno -> nema ffmpeg
const OUTPUT_FORMAT = "wav_22050";

export async function convertTextToSpeech({ text, fileName }) {
  if (!elevenKey) throw new Error("Missing ELEVEN_LABS_API_KEY");
  if (!voiceId) throw new Error("Missing ELEVEN_LABS_VOICE_ID");

  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream` +
    `?output_format=${OUTPUT_FORMAT}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": elevenKey,
      "Content-Type": "application/json",
      Accept: "audio/wav",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      optimize_streaming_latency: 3, // 🔥 OGROMNO ubrzanje
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.7,
        style: 0.7,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${t}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(fileName, buf);

  console.log("🎤 TTS generated:", fileName);

  return fileName;
}