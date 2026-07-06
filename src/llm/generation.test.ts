import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_TOKEN_TIMEOUT_MS,
  INTER_TOKEN_TIMEOUT_MS,
  generate,
  type CompletionChunk,
  type GenerationCallbacks,
  type GenerationEngine,
} from "./generation";

function chunk(content: string): CompletionChunk {
  return { choices: [{ delta: { content } }] };
}

function makeEngine(
  stream: AsyncIterable<CompletionChunk>
): GenerationEngine & { interrupted: boolean } {
  const engine = {
    interrupted: false,
    chat: { completions: { create: async () => stream } },
    interruptGenerate() {
      engine.interrupted = true;
    },
  };
  return engine;
}

function makeCallbacks() {
  return {
    updates: [] as string[],
    finals: [] as string[],
    errors: [] as string[],
    get callbacks(): GenerationCallbacks {
      return {
        onUpdate: (p) => this.updates.push(p),
        onFinish: (f) => this.finals.push(f),
        onError: (e) => this.errors.push(e),
      };
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generate", () => {
  it("accumulates deltas and finishes with the full reply", async () => {
    const stream = (async function* () {
      yield chunk("Hello");
      yield chunk(" fish");
    })();
    const cb = makeCallbacks();

    await generate(makeEngine(stream), [], cb.callbacks);

    expect(cb.finals).toEqual(["Hello fish"]);
    expect(cb.errors).toEqual([]);
  });

  it("reports a stall when the first token never arrives", async () => {
    const stream = {
      // eslint-disable-next-line require-yield
      async *[Symbol.asyncIterator]() {
        await new Promise(() => {}); // hangs forever
      },
    } as AsyncIterable<CompletionChunk>;
    const engine = makeEngine(stream);
    const cb = makeCallbacks();

    const done = generate(engine, [], cb.callbacks);
    await vi.advanceTimersByTimeAsync(FIRST_TOKEN_TIMEOUT_MS);

    expect(cb.errors).toEqual(["The model did not start responding. It may be stuck — try again."]);
    expect(engine.interrupted).toBe(true);
    expect(cb.finals).toEqual([]);
    void done; // the generator hangs by design; the watchdog already reported
  });

  it("reports a stall when tokens stop mid-reply", async () => {
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield chunk("partial");
        await new Promise(() => {}); // hangs after the first token
      },
    } as AsyncIterable<CompletionChunk>;
    const engine = makeEngine(stream);
    const cb = makeCallbacks();

    const done = generate(engine, [], cb.callbacks);
    await vi.advanceTimersByTimeAsync(INTER_TOKEN_TIMEOUT_MS);

    expect(cb.errors).toEqual(["The model stopped responding partway through — try again."]);
    expect(engine.interrupted).toBe(true);
    void done;
  });

  it("reports errors thrown by the engine", async () => {
    const engine: GenerationEngine = {
      chat: {
        completions: {
          create: async () => {
            throw new Error("boom");
          },
        },
      },
      interruptGenerate() {},
    };
    const cb = makeCallbacks();

    await generate(engine, [], cb.callbacks);

    expect(cb.errors).toEqual(["Error: boom"]);
    expect(cb.finals).toEqual([]);
  });
});
