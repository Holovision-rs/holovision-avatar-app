import { execCommand } from "../utils/files.mjs";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getPhonemes = async ({ inputWav, outputJson }) => {
  const time = Date.now();
  console.log(`🎙️ Rhubarb start: ${inputWav}`);

  if (!fs.existsSync("audios")) fs.mkdirSync("audios", { recursive: true });

  const isWin = os.platform() === "win32";
  const rhubarbBin = isWin ? "rhubarb.exe" : "rhubarb";
  const rhubarbPath = path.join(__dirname, "..", ".bin", rhubarbBin);

  if (!fs.existsSync(rhubarbPath)) throw new Error(`Rhubarb NOT FOUND: ${rhubarbPath}`);
  if (!fs.existsSync(inputWav)) throw new Error(`Input WAV NOT FOUND: ${inputWav}`);

  await execCommand({
    command: `"${rhubarbPath}" -f json -o "${outputJson}" "${inputWav}" -r phonetic`,
  });

  if (!fs.existsSync(outputJson)) throw new Error(`JSON not created: ${outputJson}`);

  console.log(`🗣️ Rhubarb done in ${Date.now() - time}ms -> ${outputJson}`);
};