import * as webllm from "@mlc-ai/web-llm";
import { parseReasoning } from "../state/reasoningParser";
import {
  generate,
  type GenerationCallbacks,
  type GenerationEngine,
  type LlmMessage,
} from "./generation";

export const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

const SYSTEM_PROMPT =
  "You are ChatFish, a friendly fish that loves to chat with people. You are the color orange";

let engine: GenerationEngine | undefined;
let loadedModel: string | null = null;
const transcript: LlmMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

export function getAvailableModels(): string[] {
  return webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
}

// Ids of models whose weights are already cached locally. web-llm tracks this
// in the browser Cache Storage, so we don't keep a parallel list.
export async function getDownloadedModels(): Promise<string[]> {
  const ids = getAvailableModels();
  const cached = await Promise.all(
    ids.map(async (id) =>
      (await webllm.hasModelInCache(id, webllm.prebuiltAppConfig)) ? id : null
    )
  );
  return cached.filter((id): id is string => id !== null);
}

export function resetEngine(): void {
  engine = undefined;
  loadedModel = null;
  // Loading a (re)new engine starts a fresh conversation: keep only the system
  // prompt so a switched-to model isn't conditioned on the old model's turns.
  transcript.length = 1;
}

// Returns the id of the model now loaded in the engine, or null if loading failed.
export async function initializeEngine(
  modelId: string,
  onProgress: (text: string, progress: number) => void,
  onError: (message: string) => void
): Promise<string | null> {
  if (!engine) {
    try {
      const created = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
        modelId,
        { initProgressCallback: (report) => onProgress(report.text, report.progress) }
      );
      // The web-llm engine satisfies GenerationEngine structurally; the cast
      // avoids coupling our narrow interface to web-llm's full request types.
      engine = created as unknown as GenerationEngine;
      loadedModel = modelId;
    } catch (error) {
      onError("There was an error downloading this model. \n\n" + String(error));
      return null;
    }
  }
  return loadedModel;
}

export async function sendChatMessage(text: string, callbacks: GenerationCallbacks): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  if (!engine) {
    throw new Error("WebLLM engine is not initialized");
  }

  transcript.push({ role: "user", content: trimmed });

  await generate(engine, transcript, {
    onUpdate: callbacks.onUpdate,
    onFinish(final) {
      // Persist only the answer in history. A reasoning model's <think> chain-
      // of-thought must not be replayed into later turns: it bloats the context
      // window and these models are trained to condition on prior answers only.
      transcript.push({ role: "assistant", content: parseReasoning(final).answer });
      callbacks.onFinish(final);
    },
    onError: callbacks.onError,
  });
}
