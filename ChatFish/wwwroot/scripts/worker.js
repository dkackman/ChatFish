import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// Hookup an engine to a worker handler
const handler = new webllm.WebWorkerMLCEngineHandler();
self.onmessage = (msg) => {
  handler.onmessage(msg);
};
