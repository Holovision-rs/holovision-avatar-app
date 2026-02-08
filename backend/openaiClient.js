import dotenv from "dotenv";
dotenv.config(); // učita backend/.env

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;