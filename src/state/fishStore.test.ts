import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function load() {
  return await import("./fishStore");
}

describe("fishStore", () => {
  it("starts with ai and user fish, empty and hidden", async () => {
    const { useFishStore, AI_FISH_ID, USER_FISH_ID } = await load();
    const { fish } = useFishStore.getState();

    expect(fish[AI_FISH_ID]).toMatchObject({
      color: "Orange",
      scale: "1.0",
      isMessageVisible: false,
    });
    expect(fish[USER_FISH_ID]).toMatchObject({
      color: "Blue",
      scale: "0.9",
      isMessageVisible: false,
    });
  });

  it("setting a message makes it visible", async () => {
    const { useFishStore, AI_FISH_ID } = await load();
    const { fromMessage } = await import("./chatMessage");

    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));

    const fish = useFishStore.getState().fish[AI_FISH_ID];
    expect(fish.isMessageVisible).toBe(true);
    expect(fish.message.message).toBe("hello");
  });

  it("setting an equal message does not notify subscribers again", async () => {
    const { useFishStore, AI_FISH_ID } = await load();
    const { fromMessage } = await import("./chatMessage");
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));

    let changes = 0;
    const unsubscribe = useFishStore.subscribe(() => changes++);
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));
    unsubscribe();

    expect(changes).toBe(0);
  });

  it("clearing the message hides it", async () => {
    const { useFishStore, AI_FISH_ID } = await load();
    const { fromMessage, emptyMessage } = await import("./chatMessage");
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));

    useFishStore.getState().setFishMessage(AI_FISH_ID, emptyMessage());

    expect(useFishStore.getState().fish[AI_FISH_ID].isMessageVisible).toBe(false);
  });

  it("hides the message after the visibility timeout", async () => {
    const { useFishStore, AI_FISH_ID, MESSAGE_VISIBILITY_MS } = await load();
    const { fromMessage } = await import("./chatMessage");
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));

    vi.advanceTimersByTime(MESSAGE_VISIBILITY_MS);

    const fish = useFishStore.getState().fish[AI_FISH_ID];
    expect(fish.isMessageVisible).toBe(false);
    expect(fish.message.message).toBe("hello"); // message kept, just hidden
  });

  it("a new message restarts the visibility timer", async () => {
    const { useFishStore, AI_FISH_ID, MESSAGE_VISIBILITY_MS } = await load();
    const { fromMessage } = await import("./chatMessage");
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("one"));

    vi.advanceTimersByTime(MESSAGE_VISIBILITY_MS - 1000);
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("two"));
    vi.advanceTimersByTime(MESSAGE_VISIBILITY_MS - 1000);

    expect(useFishStore.getState().fish[AI_FISH_ID].isMessageVisible).toBe(true);
  });
});
