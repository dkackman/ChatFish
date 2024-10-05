import * as webllm from "./web-llm.js";

// Hookup an engine to a worker handler
const handler = new webllm.WebWorkerMLCEngineHandler();
self.onmessage = (msg) => {
  handler.onmessage(msg);
};
