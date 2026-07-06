import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationCallbacks } from "../llm/generation";

vi.mock("../llm/engine", () => ({
  sendChatMessage: vi.fn(async () => {}),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

async function load() {
  const dispatcher = await import("./dispatcher");
  const fishStore = await import("./fishStore");
  const llm = await import("../llm/engine");
  return { ...dispatcher, ...fishStore, llm };
}

describe("dispatchMessage", () => {
  it.each(["", "   ", "/"])("ignores empty input %j", async (input) => {
    const { dispatchMessage, useFishStore, llm } = await load();
    const before = useFishStore.getState();

    await dispatchMessage(input);

    expect(llm.sendChatMessage).not.toHaveBeenCalled();
    expect(useFishStore.getState()).toBe(before); // no state change at all
  });

  it("/help raises a toast listing commands and emotes", async () => {
    const { dispatchMessage, useFishStore } = await load();

    await dispatchMessage("/help");

    const toast = useFishStore.getState().toast;
    expect(toast?.title).toBe("Help");
    expect(toast?.messages?.some((m) => m.startsWith("/help"))).toBe(true);
    expect(toast?.messages?.some((m) => m.startsWith("/about"))).toBe(true);
    expect(toast?.messages?.some((m) => m.startsWith("/shout"))).toBe(true); // emote listed too
  });

  it("/about opens the GitHub repo", async () => {
    const { dispatchMessage, ABOUT_URL } = await load();
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    await dispatchMessage("/about");

    expect(open).toHaveBeenCalledWith(ABOUT_URL, "_blank");
  });

  it("/llm opens the settings dialog", async () => {
    const { dispatchMessage, useFishStore } = await load();
    useFishStore.getState().closeSettings();

    await dispatchMessage("/llm");

    expect(useFishStore.getState().isSettingsVisible).toBe(true);
  });

  it("a plain message shows the user bubble, an AI thinking bubble, and reaches the LLM", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID, USER_FISH_ID } = await load();

    await dispatchMessage("hello fish");

    expect(llm.sendChatMessage).toHaveBeenCalledWith("hello fish", expect.any(Object));
    expect(useFishStore.getState().fish[USER_FISH_ID].message.message).toBe("hello fish");
    expect(useFishStore.getState().fish[AI_FISH_ID].message.modifier).toBe("thinking");
  });

  it("an emote is sent to the LLM, not treated as a command", async () => {
    const { dispatchMessage, useFishStore, llm, USER_FISH_ID } = await load();

    await dispatchMessage("/shout hello");

    expect(llm.sendChatMessage).toHaveBeenCalledWith("hello", expect.any(Object));
    expect(useFishStore.getState().fish[USER_FISH_ID].message.modifier).toBe("shout");
    expect(useFishStore.getState().toast).toBeNull();
  });

  it("streaming reasoning keeps the thinking bubble with a live peek", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID } = await load();
    let callbacks: GenerationCallbacks | undefined;
    vi.mocked(llm.sendChatMessage).mockImplementation(async (_t, cb) => {
      callbacks = cb;
    });

    await dispatchMessage("question");
    callbacks!.onUpdate("<think>pondering the deep");

    const ai = useFishStore.getState().fish[AI_FISH_ID];
    expect(ai.message.modifier).toBe("thinking");
    expect(ai.message.reasoning).toBe("pondering the deep");
  });

  it("streaming answer text replaces the thinking bubble", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID } = await load();
    let callbacks: GenerationCallbacks | undefined;
    vi.mocked(llm.sendChatMessage).mockImplementation(async (_t, cb) => {
      callbacks = cb;
    });

    await dispatchMessage("question");
    callbacks!.onUpdate("<think>done</think>Here you go");

    expect(useFishStore.getState().fish[AI_FISH_ID].message.message).toBe("Here you go");
  });

  it("an empty final answer falls back to a friendly note", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID, EMPTY_REPLY_FALLBACK } = await load();
    let callbacks: GenerationCallbacks | undefined;
    vi.mocked(llm.sendChatMessage).mockImplementation(async (_t, cb) => {
      callbacks = cb;
    });

    await dispatchMessage("question");
    callbacks!.onFinish("<think>only thoughts</think>");

    expect(useFishStore.getState().fish[AI_FISH_ID].message.message).toBe(EMPTY_REPLY_FALLBACK);
  });

  it("a send failure tells the user to load a model first", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID, NO_MODEL_MESSAGE } = await load();
    vi.mocked(llm.sendChatMessage).mockRejectedValueOnce(new Error("WebLLM engine is not initialized"));

    await dispatchMessage("hello");

    expect(useFishStore.getState().fish[AI_FISH_ID].message.message).toBe(NO_MODEL_MESSAGE);
  });

  it("ignores a second send while a reply is still streaming", async () => {
    const { dispatchMessage, useFishStore, llm } = await load();
    let resolveSend!: () => void;
    vi.mocked(llm.sendChatMessage).mockImplementation(
      () => new Promise<void>((resolve) => (resolveSend = resolve)),
    );

    const first = dispatchMessage("first message");
    // sendToFish runs synchronously up to the awaited sendChatMessage call, so
    // isGenerating is already true here without needing to await anything.
    expect(useFishStore.getState().isGenerating).toBe(true);

    await dispatchMessage("second message");

    expect(llm.sendChatMessage).toHaveBeenCalledTimes(1);
    expect(llm.sendChatMessage).toHaveBeenCalledWith("first message", expect.any(Object));

    resolveSend();
    await first;
    expect(useFishStore.getState().isGenerating).toBe(false);
  });
});
