# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ChatFish is a React 19 + TypeScript + Vite SPA: an animated fish tank where an AI fish chats with you using a local LLM. Inference runs entirely client-side via [web-llm](https://github.com/mlc-ai/web-llm) — the model is downloaded to the browser and run on WebGPU in a Web Worker; no server, no data leaves the machine.

## Commands

```sh
npm run dev           # start Vite dev server
npm run build          # tsc -b && vite build -> dist/
npm test               # vitest run (single run, CI mode)
npm run test:watch     # vitest watch mode
npx vitest run src/engine/geometry.test.ts   # run a single test file
npm run lint           # eslint .
npm run format         # prettier --write .
npm run format:check   # prettier --check .
```

CI (`.github/workflows/ci.yml`) runs `npm test` then `npm run build` on push/PR to `master`. Node >= 24 is required (see `engines` in package.json).

Requires a WebGPU-capable browser (recent Chrome/Edge/Firefox) to actually exercise the LLM at runtime; unit tests run under jsdom and don't need WebGPU.

## Architecture

Three largely independent layers, wired together by a thin dispatcher:

- **`src/engine/`** — pure fish-tank physics/animation, no React or DOM dependencies beyond `getBoundingClientRect`. `ticker.ts` runs a `requestAnimationFrame` loop that steps the simulation in fixed `TICK_MS` (50ms) increments — this cadence matches physics constants (speeds, turn probabilities) inherited from the original Blazor app's 50ms timer, so don't change `TICK_MS` without re-tuning `fishAnimation.ts`. `geometry.ts` handles tank bounds/collision math.

- **`src/llm/`** — wraps `@mlc-ai/web-llm`. `engine.ts` owns a module-level singleton (`engine`, `loadedModel`, `transcript`) — there is one shared conversation transcript across the whole app, not one per component. `worker.ts` is the actual Web Worker entry (loaded via `new Worker(new URL("./worker.ts", ...))`) that runs `WebWorkerMLCEngineHandler` off the main thread. `generation.ts` defines the narrow `GenerationEngine`/`GenerationCallbacks` interface that `engine.ts` adapts web-llm to, so the rest of the app isn't coupled to web-llm's full API surface.

- **`src/state/`** — Zustand stores plus message/command parsing.
  - `fishStore.ts`: UI state (per-fish message bubbles with auto-hide timers, toast, settings dialog visibility, offline flag, `isGenerating` guard).
  - `llmStore.ts`: model selection/download/load state, persists `selectedModel` to `localStorage`.
  - `dispatcher.ts`: the seam between chat input and the LLM — parses slash commands (`/help`, `/about`, `/llm`) vs. emotes vs. plain messages, streams tokens from `sendChatMessage` into the AI fish's bubble, and defers to `reasoningParser.ts` to split a model's `<think>...</think>` chain-of-thought from its actual answer (only the answer is shown and persisted to transcript; reasoning is transient).
  - `isGenerating` in `fishStore` exists specifically to stop a second send from racing a second `generate()` call against the same shared engine/transcript — don't remove this guard without replacing the underlying serialization.

- **`src/components/`** — presentational React components (`FishTank`, `Fish`, `ChatInput`, `MessageBubble`, `LLMSettingsDialog`, `FloatingToast`) that read/write the Zustand stores above; no business logic of note lives here beyond wiring.

Data flow for a chat turn: `ChatInput` → `dispatcher.dispatchMessage` → `llm/engine.sendChatMessage` (pushes onto the shared transcript, calls into the worker) → streamed `onUpdate`/`onFinish` callbacks → `reasoningParser` splits thinking vs. answer → `fishStore.setFishMessage` updates the bubble.

## PWA / deployment

- `vite-plugin-pwa` precaches build assets; the web-llm chunk is large, so `maximumFileSizeToCacheInBytes` is raised to 10MiB in `vite.config.ts`. Model *weights* are fetched/cached separately by web-llm itself (browser Cache Storage), not by the service worker precache.
- The site is published to a DIG (Chia) on-chain store; `dig.toml` at the repo root configures `store-id`, `output-dir` (`dist`), and the `build-command` run before each `digstore deploy`.
