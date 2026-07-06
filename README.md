# ChatFish

ChatFish is a whimsical React SPA: a tank of animated fish where you chat with an AI fish that runs **entirely in your browser**. There is no server-side inference and no chat data ever leaves your machine — the language model is downloaded and executed locally via [web-llm](https://github.com/mlc-ai/web-llm).

## Features

- A friendly AI fish powered by a local LLM (default: `Llama-3.2-1B-Instruct`).
- Swimming, draggable fish with speech-bubble messages.
- Slash commands: `/help`, `/about`, `/llm` (configure the model), plus `/shout` and `/whisper` emotes.
- Offline-aware and installable as a PWA.

## Requirements

- A browser with [**WebGPU**](https://caniuse.com/webgpu) support (recent Chrome, Edge, or Firefox). web-llm cannot run without it.
- Enough disk/GPU memory to download and host the selected model. Models are fetched in the browser on first use and cached, so the initial download can be large (hundreds of MB to several GB depending on the model).
- [Node.js](https://nodejs.org/) 24+ to build and run.

## Running locally

```sh
npm install
npm run dev
```

Then open the URL printed in the console. Open the LLM settings (the `/llm` command or the settings dialog), pick a model, and click **Download**. Once the model finishes loading, chat with the orange AI fish.

## How it works

- React renders the fish-tank UI; a fixed-step animation loop drives the fish physics ([`src/engine/`](src/engine/)) and writes positions directly to the DOM.
- [`src/llm/`](src/llm/) drives web-llm, which runs the model in a dedicated Web Worker to keep the UI responsive.
- `npm test` runs the unit tests; `npm run build` outputs a static site to `dist/`.

## License

See [LICENSE.txt](LICENSE.txt).
