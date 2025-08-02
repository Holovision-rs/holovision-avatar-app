import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const convertAudioToText = async ({ audioData }) => {
  const tmpDir = path.join(process.cwd(), "tmp");
  const tempFilePath = path.join(tmpDir, "whisper_input.mp3");

  try {
    // Osiguraj da tmp postoji
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }

    // Snimi MP3 fajl
    fs.writeFileSync(tempFilePath, audioData);

    // Pošalji ga OpenAI Whisper API-ju
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    return response.text;
  } catch (error) {
    console.error("Error in convertAudioToText:", error);
    return "";
  } finally {
    // Opciono obriši temp fajl
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
};
