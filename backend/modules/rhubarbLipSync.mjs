import { execCommand } from "../utils/files.mjs";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Render / Linux: koristi /tmp (RAM / brže)
// Ako si već prosledio outputJson kao /tmp/... onda će ostati tako.
const withTmpIfRelative = (p) => {
  if (!p) return p;
  if (p.startsWith("/") || p.includes(":\\") || p.includes(":/")) return p; // već apsolutno (linux/win)
  return path.join(os.tmpdir(), p);
};

export const getPhonemes = async ({ inputWav, outputJson }) => {
  const t0 = Date.now();

  // ✅ prebaci u /tmp ako su relative putanje
  const inWav = withTmpIfRelative(inputWav);
  const outJson = withTmpIfRelative(outputJson);

  console.log(`🎙️ Rhubarb start: ${inWav}`);

  const isWin = os.platform() === "win32";
  const rhubarbBin = isWin ? "rhubarb.exe" : "rhubarb";
  const rhubarbPath = path.join(__dirname, "..", ".bin", rhubarbBin);

  if (!fs.existsSync(rhubarbPath)) throw new Error(`Rhubarb NOT FOUND: ${rhubarbPath}`);
  if (!fs.existsSync(inWav)) throw new Error(`Input WAV NOT FOUND: ${inWav}`);

  // ✅ threads (opciono) - zavisi od CPU
  const threads = Math.min(4, Math.max(1, os.cpus()?.length || 1));

  // ✅ BRŽI recognizer
  // phonetic je spor, pocketSphinx je mnogo brži (za TTS je skroz ok)
  const cmd =
    `"${rhubarbPath}" -f json -o "${outJson}" "${inWav}" ` +
    `-r pocketSphinx --threads ${threads}`;

   await execCommand({ command: cmd, timeoutMs: 22000 });

  if (!fs.existsSync(outJson)) throw new Error(`JSON not created: ${outJson}`);

  console.log(`🗣️ Rhubarb done in ${Date.now() - t0}ms -> ${outJson}`);
};