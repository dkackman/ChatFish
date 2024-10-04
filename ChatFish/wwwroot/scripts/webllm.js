import * as webllm from "https://esm.run/@mlc-ai/web-llm";

/*************** WebLLM logic ***************/

async function generating(messages, onFinish, onError) {
  try {
    const request = {
      messages: messages,
      temperature: 0.5,
      top_p: 1,
    };

    await window.engine.chat.completions.create(request);
    const finalMessage = await window.engine.getMessage();
    onFinish(finalMessage);
  } catch (err) {
    onError(err);
  }
}

// interop methods called from razor code
window.getAvailableModels = () => {
  return webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
};

window.resetLLMEngine = () => {
  window.engine = undefined;
};

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
    } catch (error) {
      dotNetHelper.invokeMethodAsync(
        "OnMessageError",
        "There was an error downloading this model. Please try a different one."
      );
    }
  }
};

window.sendLLMMessage = async (transcript, dotNetHelper) => {
  if (!window.engine) {
    throw new Error("WebLLM engine is not initialized");
  }

  const onFinish = (finalMessage) => {
    dotNetHelper.invokeMethodAsync("OnMessageFinish", finalMessage);
  };

  const onError = (error) => {
    dotNetHelper.invokeMethodAsync("OnMessageError", error.toString());
  };

  try {
    await generating(transcript, onFinish, onError);
  } catch (error) {
    onError(error);
  }
};
