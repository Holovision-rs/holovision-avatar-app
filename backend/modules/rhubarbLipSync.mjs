import { execCommand } from "../utils/files.mjs";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getPhonemes = async ({ message }) => {
  try {
    const time = Date.now();
    console.log(`🎙️ Starting conversion for message ${message}`);

    // ✅ osiguraj folder
    if (!fs.existsSync("audios")) fs.mkdirSync("audios", { recursive: true });

    const inputMp3 = `audios/message_${message}.mp3`;
    const outputWav = `audios/message_${message}.wav`;
    const outputJson = `audios/message_${message}.json`;

    const isWin = os.platform() === "win32";
    const rhubarbBin = isWin ? "rhubarb.exe" : "rhubarb";

    // ✅ ABSOLUTE path (production safe)
    const rhubarbPath = path.join(__dirname, "..", ".bin", rhubarbBin);

    console.log("👉 Rhubarb path:", rhubarbPath);

    if (!fs.existsSync(rhubarbPath)) {
      throw new Error(`Rhubarb binary NOT FOUND at ${rhubarbPath}`);
    }

    if (!fs.existsSync(inputMp3)) {
      throw new Error(`Input MP3 not found: ${inputMp3}`);
    }

    // MP3 -> WAV
    await execCommand({
      command: `ffmpeg -y -i "${inputMp3}" -ar 44100 -ac 1 -sample_fmt s16 "${outputWav}"`,
    });
    console.log(`🎧 MP3 -> WAV done in ${Date.now() - time}ms`);

    // Lip sync
    await execCommand({
      command: `"${rhubarbPath}" -f json -o "${outputJson}" "${outputWav}" -r phonetic`,
    });
    console.log(`🗣️ Lip sync JSON done in ${Date.now() - time}ms`);

    // ✅ tek sad proveri JSON
    if (!fs.existsSync(outputJson)) {
      throw new Error(`Rhubarb finished but JSON not created: ${outputJson}`);
    }

    console.log("✅ Rhubarb finished for message", message);
  } catch (error) {
    console.error(`❌ Error while getting phonemes for message ${message}:`, error);
    throw error; // da /sts vrati pravi error
  }
};

export { getPhonemes };