import * as webllm from "./web-llm.js";

/*************** WebLLM logic ***************/

// web-llm exposes no dedicated "thinking" event during inference; the token
// stream is the only signal that generation is alive. So we stream and treat a
// gap in that stream as a stall. Two windows catch the two failure modes:
//   - FIRST_TOKEN: generation never starts producing output (wedged prefill).
//   - INTER_TOKEN: it started, then went silent mid-reply.
const FIRST_TOKEN_TIMEOUT_MS = 30000;
const INTER_TOKEN_TIMEOUT_MS = 20000;

// Throttle partial-update interop so a fast token stream doesn't flood Blazor
// with re-render/measure round-trips. The final text is always flushed.
const UPDATE_THROTTLE_MS = 60;

async function generating(messages, onUpdate, onFinish, onError) {
  let watchdog;
  let stalled = false;

  const armWatchdog = (ms, reason) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      stalled = true;
      // Stop the in-flight generation so the worker isn't left spinning.
      Promise.resolve(window.engine.interruptGenerate()).catch(() => {});
      onError(new Error(reason));
    }, ms);
  };

  try {
    const chunks = await window.engine.chat.completions.create({
      messages: messages,
      temperature: 0.5,
      top_p: 1,
      stream: true,
    });

    armWatchdog(
      FIRST_TOKEN_TIMEOUT_MS,
      "The model did not start responding. It may be stuck — try again."
    );

    let reply = "";
    let lastFlush = 0;
    for await (const chunk of chunks) {
      if (stalled) {
        return;
      }
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        reply += delta;
        armWatchdog(
          INTER_TOKEN_TIMEOUT_MS,
          "The model stopped responding partway through — try again."
        );
        const now = performance.now();
        if (now - lastFlush > UPDATE_THROTTLE_MS) {
          lastFlush = now;
          onUpdate(reply);
        }
      }
    }

    clearTimeout(watchdog);
    if (stalled) {
      return;
    }
    onFinish(reply);
  } catch (err) {
    clearTimeout(watchdog);
    if (!stalled) {
      onError(err);
    }
  }
}

// interop methods called from razor code
window.getAvailableModels = () => {
  return webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
};

// Returns the ids of models whose weights are already cached locally. web-llm
// tracks this in the browser Cache Storage, so we don't keep a parallel list.
window.getDownloadedModels = async () => {
  const ids = webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
  const cached = await Promise.all(
    ids.map(async (id) =>
      (await webllm.hasModelInCache(id, webllm.prebuiltAppConfig)) ? id : null
    )
  );
  return cached.filter((id) => id !== null);
};

window.resetLLMEngine = () => {
  window.engine = undefined;
  window.loadedModel = undefined;
};

// Returns the id of the model now loaded in the engine, or null if loading failed.
window.initializeWebLLMEngine = async (selectedModel, dotNetHelper) => {
  if (!window.engine) {
    const initProgressCallback = (report) => {
      dotNetHelper.invokeMethodAsync(
        "UpdateEngineInitProgress",
        report.text,
        report.progress
      );
    };
    try {
      window.engine = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL("./worker.js", import.meta.url), { type: "module" }),
        selectedModel,
        { initProgressCallback: initProgressCallback }
      );
      window.loadedModel = selectedModel;
    } catch (error) {
      dotNetHelper.invokeMethodAsync(
        "OnMessageError",
        "There was an error downloading this model. \n\n" + error.toString()
      );
      return null;
    }
  }
  return window.loadedModel ?? null;
};

window.sendLLMMessage = async (transcript, dotNetHelper) => {
  if (!window.engine) {
    throw new Error("WebLLM engine is not initialized");
  }

  const onUpdate = (partialMessage) => {
    dotNetHelper.invokeMethodAsync("OnMessageUpdate", partialMessage);
  };

  const onFinish = (finalMessage) => {
    dotNetHelper.invokeMethodAsync("OnMessageFinish", finalMessage);
  };

  const onError = (error) => {
    dotNetHelper.invokeMethodAsync("OnMessageError", error.toString());
  };

  try {
    await generating(transcript, onUpdate, onFinish, onError);
  } catch (error) {
    onError(error);
  }
};
