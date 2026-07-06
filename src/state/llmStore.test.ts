import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../llm/engine", () => ({
  DEFAULT_MODEL: "model-a",
  getAvailableModels: vi.fn(() => ["model-a", "model-b"]),
  getDownloadedModels: vi.fn(async () => ["model-a"]),
  resetEngine: vi.fn(),
  initializeEngine: vi.fn(async () => "model-b"),
  sendChatMessage: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
});

async function load() {
  return await import("./llmStore");
}

describe("llmStore", () => {
  it("initialize populates models and restores the saved selection", async () => {
    localStorage.setItem("selectedModel", "model-b");
    const { useLlmStore } = await load();

    await useLlmStore.getState().initialize();

    const state = useLlmStore.getState();
    expect(state.availableModels).toEqual(["model-a", "model-b"]);
    expect(state.downloadedModels).toEqual(["model-a"]);
    expect(state.selectedModel).toBe("model-b");
  });

  it("selectModel rejects unknown models", async () => {
    const { useLlmStore } = await load();
    await useLlmStore.getState().initialize();

    useLlmStore.getState().selectModel("bogus");

    expect(useLlmStore.getState().selectedModel).toBe("model-a");
    expect(localStorage.getItem("selectedModel")).toBeNull();
  });

  it("selectModel persists a valid selection", async () => {
    const { useLlmStore } = await load();
    await useLlmStore.getState().initialize();

    useLlmStore.getState().selectModel("model-b");

    expect(useLlmStore.getState().selectedModel).toBe("model-b");
    expect(localStorage.getItem("selectedModel")).toBe("model-b");
  });

  it("loadEngine resets, loads, and refreshes downloaded models", async () => {
    const llm = await import("../llm/engine");
    const { useLlmStore } = await load();
    await useLlmStore.getState().initialize();
    useLlmStore.getState().selectModel("model-b");

    await useLlmStore.getState().loadEngine();

    expect(llm.resetEngine).toHaveBeenCalled();
    expect(llm.initializeEngine).toHaveBeenCalledWith(
      "model-b",
      expect.any(Function),
      expect.any(Function)
    );
    expect(useLlmStore.getState().downloadedModels).toEqual(["model-a"]);
    expect(useLlmStore.getState().loadedModel).toBe("model-b");
    expect(useLlmStore.getState().isProgressVisible).toBe(true);
  });

  it("loadEngine errors surface in the progress text and the AI bubble", async () => {
    const llm = await import("../llm/engine");
    vi.mocked(llm.initializeEngine).mockImplementationOnce(async (_m, _p, onError) => {
      onError("There was an error downloading this model.");
      return null;
    });
    const { useLlmStore } = await load();
    const { useFishStore, AI_FISH_ID } = await import("./fishStore");
    await useLlmStore.getState().initialize();

    await useLlmStore.getState().loadEngine();

    expect(useLlmStore.getState().loadedModel).toBeNull();
    expect(useLlmStore.getState().progressText).toContain("error downloading");
    expect(useFishStore.getState().fish[AI_FISH_ID].message.message).toContain("error downloading");
  });
});
