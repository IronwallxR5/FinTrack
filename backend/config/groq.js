const Groq = require("groq-sdk");

let groq = null;

if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
} else {
  console.warn("[Groq] GROQ_API_KEY is not set — AI features will be disabled.");
}

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

module.exports = { groq, GROQ_MODEL };
