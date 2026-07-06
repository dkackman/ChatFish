import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompletionChunk, LlmMessage } from "./generation";

interface ChatCompletionRequest {
  messages: LlmMessage[];
  top_p: number;
  repetition_penalty: number;
  max_tokens: number;
  stream: true;
}

const fakeEngine = {
  chat: {
    completions: {
      create: vi.fn(async (_request: ChatCompletionRequest) =>
        (async function* (): AsyncGenerator<CompletionChunk> {
          yield { choices: [{ delta: { content: "<think>hmm</think>fish reply" } }] };
        })(),
      ),
    },
  },
  interruptGenerate: vi.fn(),
};

vi.mock("@mlc-ai/web-llm", () => ({
  prebuiltAppConfig: { model_list: [{ model_id: "model-a" }, { model_id: "model-b" }] },
  hasModelInCache: vi.fn(async (id: string) => id === "model-a"),
  CreateWebWorkerMLCEngine: vi.fn(async () => fakeEngine),
}));

beforeEach(() => {
  vi.resetModules();
  fakeEngine.chat.completions.create.mockClear();
  // jsdom has no Worker; engine.ts constructs one to hand to web-llm (mocked above).
  vi.stubGlobal("Worker", class { constructor() {} });
});

async function load() {
  return await import("./engine");
}

const noProgress = () => {};
const noError = () => {};

describe("engine", () => {
  it("lists available models from the prebuilt config", async () => {
    const engine = await load();
    expect(engine.getAvailableModels()).toEqual(["model-a", "model-b"]);
  });

  it("lists only cached models as downloaded", async () => {
    const engine = await load();
    expect(await engine.getDownloadedModels()).toEqual(["model-a"]);
  });

  it("initializeEngine loads and reports the model id", async () => {
    const engine = await load();
    expect(await engine.initializeEngine("model-a", noProgress, noError)).toBe("model-a");
  });

  it("initializeEngine reports failures and returns null", async () => {
    const webllm = await import("@mlc-ai/web-llm");
    vi.mocked(webllm.CreateWebWorkerMLCEngine).mockRejectedValueOnce(new Error("no gpu"));
    const engine = await load();
    const errors: string[] = [];

    const result = await engine.initializeEngine("model-a", noProgress, (m) => errors.push(m));

    expect(result).toBeNull();
    expect(errors[0]).toContain("There was an error downloading this model.");
    expect(errors[0]).toContain("no gpu");
  });

  it("sendChatMessage throws when no engine is loaded", async () => {
    const engine = await load();
    await expect(
      engine.sendChatMessage("hi", { onUpdate: noProgress, onFinish: noProgress, onError: noError }),
    ).rejects.toThrow("WebLLM engine is not initialized");
  });

  it("sends the transcript and persists only the parsed answer", async () => {
    const engine = await load();
    await engine.initializeEngine("model-a", noProgress, noError);
    const finals: string[] = [];

    await engine.sendChatMessage("hello fish", {
      onUpdate: noProgress,
      onFinish: (f) => finals.push(f),
      onError: noError,
    });

    // onFinish gets the raw final (including <think>), transcript keeps the answer only
    expect(finals).toEqual(["<think>hmm</think>fish reply"]);
    const sent = fakeEngine.chat.completions.create.mock.calls[0][0].messages;
    expect(sent[0]).toEqual({
      role: "system",
      content: "You are ChatFish, a friendly fish that loves to chat with people. You are the color orange",
    });
    expect(sent[1]).toEqual({ role: "user", content: "hello fish" });

    // A second turn's request includes the prior assistant answer (no <think>)
    await engine.sendChatMessage("again", {
      onUpdate: noProgress,
      onFinish: noProgress,
      onError: noError,
    });
    const second = fakeEngine.chat.completions.create.mock.calls[1][0].messages;
    expect(second[2]).toEqual({ role: "assistant", content: "fish reply" });
  });

  it("resetEngine clears prior conversation history", async () => {
    const engine = await load();
    await engine.initializeEngine("model-a", noProgress, noError);
    await engine.sendChatMessage("hello fish", { onUpdate: noProgress, onFinish: noProgress, onError: noError });

    engine.resetEngine();
    await engine.initializeEngine("model-a", noProgress, noError);
    await engine.sendChatMessage("fresh start", { onUpdate: noProgress, onFinish: noProgress, onError: noError });

    // Only the system prompt and the new turn were sent — no leftover history
    // from the conversation before the reset. (`sent` is the live transcript
    // array, so by now it also holds this turn's own persisted answer.)
    const sent = fakeEngine.chat.completions.create.mock.calls[1][0].messages;
    expect(sent).toEqual([
      {
        role: "system",
        content: "You are ChatFish, a friendly fish that loves to chat with people. You are the color orange",
      },
      { role: "user", content: "fresh start" },
      { role: "assistant", content: "fish reply" },
    ]);
  });
});
