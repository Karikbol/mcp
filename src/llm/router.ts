import OpenAI from "openai";
import { config } from "../config.js";
import { logger } from "../logger.js";

const ollamaClient = new OpenAI({
  baseURL: `${config.ollama.baseUrl}/v1`,
  apiKey: "ollama",
});

let openaiClient: OpenAI | null = null;
if (config.openai.apiKey) {
  openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
}

export type LLMResponse = {
  content: string;
  model: string;
  latencyMs: number;
};

async function completeWithOpenAI(start: number, prompt: string): Promise<LLMResponse> {
  if (!openaiClient) {
    throw new Error("OpenAI API key not set. Set OPENAI_API_KEY.");
  }
  const model = config.openai.model;
  const response = await openaiClient.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2048,
  });
  const content = response.choices[0]?.message?.content ?? "No response";
  const latencyMs = Date.now() - start;
  logger.debug({ model, latencyMs }, "LLM OpenAI success");
  return { content, model, latencyMs };
}

async function completeWithOllama(start: number, prompt: string): Promise<LLMResponse> {
  const localResponse = await ollamaClient.chat.completions.create({
    model: config.ollama.model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2048,
  });
  const content =
    localResponse.choices[0]?.message?.content ?? "No response from model";
  const model = localResponse.model ?? config.ollama.model;
  const latencyMs = Date.now() - start;
  logger.debug({ model, latencyMs }, "LLM Ollama success");
  return { content, model, latencyMs };
}

export async function complete(prompt: string): Promise<LLMResponse> {
  const start = Date.now();

  if (config.openai.only && config.openai.apiKey) {
    return completeWithOpenAI(start, prompt);
  }

  try {
    return await completeWithOllama(start, prompt);
  } catch (err) {
    logger.warn({ err }, "Ollama failed, trying OpenAI fallback");
    if (!config.openai.fallbackEnabled || !openaiClient) {
      throw new Error(
        "Ollama failed and OpenAI fallback is disabled or no API key. Set OPENAI_FALLBACK_ENABLED=true and OPENAI_API_KEY."
      );
    }
    return completeWithOpenAI(start, prompt);
  }
}
