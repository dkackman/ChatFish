// web-llm exposes no dedicated "thinking" event during inference; the token
// stream is the only signal that generation is alive. So we stream and treat a
// gap in that stream as a stall. Two windows catch the two failure modes:
//   - FIRST_TOKEN: generation never starts producing output (wedged prefill).
//   - INTER_TOKEN: it started, then went silent mid-reply.
export const FIRST_TOKEN_TIMEOUT_MS = 30000;
export const INTER_TOKEN_TIMEOUT_MS = 20000;

// Throttle partial updates so a fast token stream doesn't flood React with
// re-render/measure cycles. The final text is always delivered via onFinish.
export const UPDATE_THROTTLE_MS = 60;

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerationCallbacks {
  onUpdate(partial: string): void;
  onFinish(final: string): void;
  onError(message: string): void;
}

export interface CompletionChunk {
  choices?: { delta?: { content?: string | null } }[];
}

// Structural subset of the web-llm engine so tests can fake it.
export interface GenerationEngine {
  chat: {
    completions: {
      create(request: {
        messages: LlmMessage[];
        top_p: number;
        repetition_penalty: number;
        max_tokens: number;
        stream: true;
      }): Promise<AsyncIterable<CompletionChunk>>;
    };
  };
  interruptGenerate(): Promise<unknown> | unknown;
}

export async function generate(
  engine: GenerationEngine,
  messages: LlmMessage[],
  callbacks: GenerationCallbacks,
): Promise<void> {
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let stalled = false;

  const armWatchdog = (ms: number, reason: string) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      stalled = true;
      // Stop the in-flight generation so the worker isn't left spinning.
      Promise.resolve(engine.interruptGenerate()).catch(() => {});
      callbacks.onError(reason);
    }, ms);
  };

  try {
    const chunks = await engine.chat.completions.create({
      messages,
      // Omit temperature so each model's own tuned mlc-chat-config default applies
      // (e.g. DeepSeek-R1 distills vs. plain instruct models want different values).
      top_p: 0.95,
      repetition_penalty: 1.1,
      // Hard backstop: a reasoning model that never emits a closing </think> can
      // otherwise generate forever, since the watchdogs below only catch a stall
      // in token *rate*, not an unbounded total length.
      max_tokens: 4096,
      stream: true,
    });

    armWatchdog(FIRST_TOKEN_TIMEOUT_MS, "The model did not start responding. It may be stuck — try again.");

    let reply = "";
    let lastFlush = 0;
    for await (const chunk of chunks) {
      if (stalled) {
        return;
      }
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        reply += delta;
        armWatchdog(INTER_TOKEN_TIMEOUT_MS, "The model stopped responding partway through — try again.");
        const now = performance.now();
        if (now - lastFlush > UPDATE_THROTTLE_MS) {
          lastFlush = now;
          callbacks.onUpdate(reply);
        }
      }
    }

    clearTimeout(watchdog);
    if (stalled) {
      return;
    }
    callbacks.onFinish(reply);
  } catch (err) {
    clearTimeout(watchdog);
    if (!stalled) {
      callbacks.onError(String(err));
    }
  }
}
