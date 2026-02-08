import dotenv from "dotenv";
dotenv.config(); // učita backend/.env

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
    // ✅ hard limit
  timeout: 13_000,

  // ✅ da ti ne “doda” još vremena kroz retry
  maxRetries: 0,
});

export default openai;