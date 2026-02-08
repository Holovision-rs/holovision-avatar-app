import { execCommand } from "../utils/files.mjs";
import path from "path";
import os from "os";

const getPhonemes = async ({ message }) => {
  try {
    const time = new Date().getTime();
    console.log(`🎙️ Starting conversion for message ${message}`);

    const inputMp3 = `audios/message_${message}.mp3`;
    const outputWav = `audios/message_${message}.wav`;
    const outputJson = `audios/message_${message}.json`;

    // ✅ Cross-platform Rhubarb binary name
    const isWin = os.platform() === "win32";
    const rhubarbBin = isWin ? "rhubarb.exe" : "rhubarb";
    const rhubarbPath = path.resolve(`.bin/${rhubarbBin}`);

    // 1) MP3 -> WAV
    await execCommand({
      command: `ffmpeg -y -i ${inputMp3} -ar 44100 -ac 1 -sample_fmt s16 ${outputWav}`,
    });
    console.log(`🎧 MP3 -> WAV done in ${new Date().getTime() - time}ms`);

    // 2) Rhubarb lip sync
    await execCommand({
      command: `"${rhubarbPath}" -f json -o "${outputJson}" "${outputWav}" -r phonetic`,
    });
    console.log(`🗣️ Lip sync JSON done in ${new Date().getTime() - time}ms`);
  } catch (error) {
    console.error(`❌ Error while getting phonemes for message ${message}:`, error);
  }
};

export { getPhonemes };