import { exec } from "child_process";
import { promises as fs } from "fs";

const execCommand = ({ command, timeoutMs = 15000 }) => {
  return new Promise((resolve, reject) => {

    const child = exec(command, {
      timeout: timeoutMs,

      // 🔥 VEOMA BITNO
      // Rhubarb zna da izbaci dosta logova
      // default je 1MB -> može da crashuje
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {

      // TIMEOUT
      if (error?.killed || error?.signal === "SIGTERM") {
        return reject(new Error(`Process timeout after ${timeoutMs}ms`));
      }

      if (error) {
        return reject(error);
      }

      resolve(stdout);
    });

  });
};

const readJsonTranscript = async ({ fileName }) => {
  const data = await fs.readFile(fileName, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async ({ fileName }) => {
  const data = await fs.readFile(fileName);
  return data.toString("base64");
};

export { execCommand, readJsonTranscript, audioFileToBase64 };