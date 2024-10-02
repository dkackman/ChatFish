import * as webllm from "https://esm.run/@mlc-ai/web-llm";

/*************** WebLLM logic ***************/
const messages = [
  {
    content: "You are cheerful fish that loves to chat with people.",
    role: "system",
  },
];

async function streamingGenerating(messages, onUpdate, onFinish, onError) {
  try {
    let curMessage = "";
    let usage;
    const completion = await window.engine.chat.completions.create({
      stream: true,
      messages,
      stream_options: { include_usage: true },
    });
    for await (const chunk of completion) {
      const curDelta = chunk.choices[0]?.delta.content;
      if (curDelta) {
        curMessage += curDelta;
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
      onUpdate(curMessage);
    }
    const finalMessage = await window.engine.getMessage();
    onFinish(finalMessage, usage);
  } catch (err) {
    onError(err);
  }
}

/*************** UI logic ***************/
function onMessageSend() {
  const input = document.getElementById("user-input").value.trim();
  const message = {
    content: input,
    role: "user",
  };
  if (input.length === 0) {
    return;
  }
  document.getElementById("send").disabled = true;

  messages.push(message);
  appendMessage(message);

  document.getElementById("user-input").value = "";
  document
    .getElementById("user-input")
    .setAttribute("placeholder", "Generating...");

  const aiMessage = {
    content: "typing...",
    role: "assistant",
  };
  appendMessage(aiMessage);

  const onFinishGenerating = (finalMessage, usage) => {
    updateLastMessage(finalMessage);
    document.getElementById("send").disabled = false;
    const usageText =
      `prompt_tokens: ${usage.prompt_tokens}, ` +
      `completion_tokens: ${usage.completion_tokens}, ` +
      `prefill: ${usage.extra.prefill_tokens_per_s.toFixed(4)} tokens/sec, ` +
      `decoding: ${usage.extra.decode_tokens_per_s.toFixed(4)} tokens/sec`;
    document.getElementById("chat-stats").classList.remove("hidden");
    document.getElementById("chat-stats").textContent = usageText;
  };

  streamingGenerating(
    messages,
    updateLastMessage,
    onFinishGenerating,
    console.error
  );
}

function appendMessage(message) {
  const chatBox = document.getElementById("chat-box");
  const container = document.createElement("div");
  container.classList.add("message-container");
  const newMessage = document.createElement("div");
  newMessage.classList.add("message");
  newMessage.textContent = message.content;

  if (message.role === "user") {
    container.classList.add("user");
  } else {
    container.classList.add("assistant");
  }

  container.appendChild(newMessage);
  chatBox.appendChild(container);
  chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the latest message
}

function updateLastMessage(content) {
  const messageDoms = document
    .getElementById("chat-box")
    .querySelectorAll(".message");
  const lastMessageDom = messageDoms[messageDoms.length - 1];
  lastMessageDom.textContent = content;
}

// interop methods called from razor code
window.getAvailableModels = () => {
  return webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
};

window.initializeWebLLMEngine = async (selectedModel, dotNetHelper) => {
  if (!window.engine) {
    window.engine = new webllm.MLCEngine();
  }

  window.engine.setInitProgressCallback((report) => {
    dotNetHelper.invokeMethodAsync(
      "UpdateEngineInitProgress",
      report.text,
      report.progress
    );
  });

  const config = {
    temperature: 1.0,
    top_p: 1,
  };

  await window.engine.reload(selectedModel, config);
};

window.sendLLMMessage = async (transcript, dotNetHelper) => {
  if (!window.engine) {
    throw new Error("WebLLM engine is not initialized");
  }

  const onUpdate = (curMessage) => {
    dotNetHelper.invokeMethodAsync("OnMessageUpdate", curMessage);
  };

  const onFinish = (finalMessage, usage) => {
    dotNetHelper.invokeMethodAsync("OnMessageFinish", finalMessage, usage);
  };

  const onError = (error) => {
    dotNetHelper.invokeMethodAsync("OnMessageError", error.toString());
  };

  try {
    await streamingGenerating(transcript, onUpdate, onFinish, onError);
  } catch (error) {
    onError(error);
  }
};
