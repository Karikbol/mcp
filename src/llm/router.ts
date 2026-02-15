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

export async function complete(prompt: string): Promise<LLMResponse> {
  const start = Date.now();

  try {
    const localResponse = await ollamaClient.chat.completions.create({
      model: config.ollama.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
    });

    const content =
      localResponse.choices[0]?.message?.content ?? "No response from model";
    const model = localResponse.model ?? config.ollama.model;
    const latencyMs = Date.now() - start;

    logger.debug({ model, latencyMs }, "LLM local (Ollama) success");
    return { content, model, latencyMs };
  } catch (err) {
    logger.warn({ err }, "Ollama failed, trying OpenAI fallback");

    if (!config.openai.fallbackEnabled || !openaiClient) {
      throw new Error(
        "Ollama failed and OpenAI fallback is disabled or no API key. Set OPENAI_FALLBACK_ENABLED=true and OPENAI_API_KEY."
      );
    }

    const fallbackResponse = await openaiClient.chat.completions.create({
      model: config.openai.fallbackModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
    });

    const content =
      fallbackResponse.choices[0]?.message?.content ?? "No response";
    const latencyMs = Date.now() - start;

    logger.info(
      { model: config.openai.fallbackModel, latencyMs },
      "LLM fallback (OpenAI) success"
    );
    return {
      content,
      model: config.openai.fallbackModel,
      latencyMs,
    };
  }
}
