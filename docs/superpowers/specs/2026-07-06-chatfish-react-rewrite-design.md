# ChatFish React Rewrite — Design

**Date:** 2026-07-06
**Status:** Approved

## Goal

Rebuild ChatFish as a 100% client-side SPA in TypeScript + React, removing the
.NET/Blazor dependency entirely. Straight feature-parity port: same features,
same behavior, no redesign. The new app lives in this repo and replaces the
dotnet projects once it reaches parity.

## Constraints

- Runs entirely in the browser: no server-side inference, no chat data leaves
  the machine. LLM via [web-llm](https://github.com/mlc-ai/web-llm) (WebGPU).
- Builds to a static output directory so the existing DIG-network deployment
  (`dig.toml`) keeps working.
- Installable PWA, offline-aware.

## Stack

- React 19 + TypeScript
- Vite + `vite-plugin-pwa` (Workbox `generateSW`)
- `@mlc-ai/web-llm` from npm (replaces the vendored `web-llm.js`)
- zustand for state stores
- Vitest for unit tests

## Feature inventory (parity checklist)

- Two fish in a tank: AI (orange, scale 1.0) and user (blue, scale 0.9).
- Fish physics: random initial position/velocity, boundary bouncing, random
  direction/speed changes (1-in-400 and 1-in-300 per tick), draggable fish
  that resume swimming in the opposite direction on release.
- Speech bubbles: shown ahead of the fish's facing direction (CSS), flipped
  above/below to avoid vertical clipping, bubble width included in horizontal
  boundary checks so the fish turns before the bubble leaves the tank.
- Thinking bubble: animated dots shown immediately on send; for reasoning
  models (`<think>…</think>` streams) a live tail-peek of the chain-of-thought
  (180-char window) renders under the dots until answer text appears.
- Slash commands: `/help` (toast listing commands + emotes), `/about` (opens
  the GitHub repo), `/llm` (opens the settings dialog). Emotes `/shout` and
  `/whisper` pass through as messages whose modifier becomes a bubble CSS
  class.
- LLM settings dialog: model list from `prebuiltAppConfig`, "(downloaded)"
  markers via web-llm's cache query, Download/Load button with progress bar,
  loaded-model status line, selected model persisted to `localStorage`
  (same key: `selectedModel`). Dialog is visible on startup, reopenable via
  `/llm`.
- Chat transcript: system prompt "You are ChatFish, a friendly fish that
  loves to chat with people. You are the color orange"; only parsed answers
  (never reasoning) are persisted to history.
- Offline detection: persistent bottom-right toast while offline.
- PWA: installable, app shell + assets precached; model weights are not
  precached (web-llm manages its own Cache Storage).
- Accessibility parity: aria-live tank status, bubble `role="status"`,
  labeled dialog/progress controls, reasoning peek `aria-hidden`.

## Architecture

The Vite app replaces the dotnet projects at the repo root. The C#↔JS interop
layer (`IJSRuntime`, `DotNetObjectReference`, `window.*` bridge functions)
disappears entirely — LLM code and UI share one language.

```
ChatFish/                  (repo root)
├── index.html
├── vite.config.ts         (vite-plugin-pwa config)
├── package.json / tsconfig.json
├── public/                (fish sprites, background, icons — copied as-is)
└── src/
    ├── main.tsx / App.tsx
    ├── components/        (React — rendering only)
    │   ├── FishTank.tsx, Fish.tsx, MessageBubble.tsx
    │   ├── ChatInput.tsx, FloatingToast.tsx, LLMSettingsDialog.tsx
    ├── engine/            (pure TS, no React — direct port of C# physics)
    │   ├── fishAnimation.ts, velocity.ts, geometry.ts (Point/Size/Rect/Direction)
    ├── llm/               (replaces LLMService.cs + chatfish-llm.js)
    │   ├── worker.ts      (web-llm Web Worker)
    │   ├── engine.ts      (init, model list, cache queries, transcript)
    │   └── generation.ts  (streaming + watchdogs)
    └── state/
        ├── chatMessage.ts, reasoningParser.ts   (direct ports)
        ├── fishStore.ts   (zustand: fish, current bubbles, offline flag)
        └── llmStore.ts    (zustand: models, download progress, loaded model)
```

### Key decisions

- **Animation stays out of React.** A `requestAnimationFrame` loop (replacing
  the 50ms `Animator` timer) runs the ported physics and writes `left`/`top`
  directly to fish element refs. React re-renders only when messages/bubbles
  change, preserving today's "no per-tick re-render" property without interop.
- **Physics is a direct port.** `FishAnimation.cs` → `fishAnimation.ts` nearly
  line-for-line: same boundary logic, bubble-extent handling, above/below
  flipping. Pure (no DOM), so the unit tests port too.
- **web-llm in a Web Worker**, as today, to keep the UI responsive.
- **No sanitizer dependency.** React escapes interpolated text (same safety as
  Blazor's encoding). The one real injection point today — `Message.Modifier`
  interpolated into the bubble's CSS class — is replaced with an allowlist of
  known emote modifiers.
- **zustand replaces C# event wiring** (`OnStateChanged`, `MessageUpdate`,
  etc.) with subscriptions React consumes natively.

## Data flow

1. `ChatInput` submits → `dispatchMessage(text)` parses via
   `chatMessage.fromMessage()`.
2. Slash commands short-circuit (`/help` toast, `/about` open URL, `/llm` open
   dialog); emotes pass through with a modifier.
3. Plain message → user fish shows the bubble, AI fish shows the animated
   thinking bubble immediately; message appended to the transcript and
   streamed to web-llm.
4. Each streamed update runs through `reasoningParser`: while inside
   `<think>` the thinking bubble shows the live reasoning peek; once answer
   text appears the bubble switches to the answer. Between `</think>` and the
   first answer token the thinking bubble stays (no blank flash). Updates
   throttled to ~60ms.
5. On finish, only the parsed answer is persisted to the transcript; an empty
   answer falls back to "🫧 (I didn't have anything to say — try again?)".

**Bubble/physics feedback:** when a bubble becomes visible it is measured once
(`getBoundingClientRect`) and fed to the physics (`setBubble`); the loop
reports above/below placement per tick. Same contract as today, via callback
instead of interop.

## Error handling (ported as-is)

- Generation watchdogs: 30s first-token, 20s inter-token; on stall call
  `interruptGenerate()` and show the stall message in the AI bubble.
- `max_tokens: 4096` backstop; `top_p: 0.95`, `repetition_penalty: 1.1`;
  temperature omitted so per-model `mlc-chat-config` defaults apply.
- Sending with no engine loaded → "Make sure to select and download a model
  first." in the AI bubble.
- Engine init/download failure → error text + reset progress in the settings
  dialog.
- Offline via `navigator.onLine` + `online`/`offline` events → persistent
  bottom-right toast.

## Testing

Port the xUnit suite to Vitest test-for-test (the covered code stays pure):

- `reasoningParser` (parse/peek)
- `chatMessage` (command/emote parsing; C# equality operators become
  structural comparison)
- `fishAnimation` (boundary bounce, bubble extents, above/below flipping)
- `velocity`, dispatcher command routing, fish state/color

No component tests (components stay thin, matching today's suite).
`SanitizerReasoningTests` does not port — it documents `HtmlSanitizer`
behavior, and that dependency is dropped.
`npm test` runs Vitest; `npm run build` runs `tsc` first so type errors fail
the build.

## Build & deploy

- `npm run dev` for local development; `npm run build` → `dist/`.
- `vite-plugin-pwa` precaches app shell + sprites, replacing
  `service-worker.published.js` and Blazor's asset manifest. Same
  `manifest.webmanifest` content and icons.
- `dig.toml`: build command → `npm ci && npm run build`; output dir → `dist`.

## Migration / cleanup (after parity is verified)

- Delete `ChatFish/`, `ChatFish.Tests/`, `ChatFish.sln`, `publish/`, dotnet
  bits of `.vscode/` (replace with Vite equivalents).
- Rewrite `README.md`: drop the .NET SDK requirement; running becomes
  `npm install && npm run dev`.
- Copy assets (`fish/` sprites, `background.jpg`, icons, favicon) into
  `public/` unchanged.

## Parity verification

Run old and new apps side by side once and walk the feature inventory:
swim/bounce/drag, bubble flip at edges, all five slash commands/emotes, model
download + load + localStorage persistence, streaming with thinking peek
(use a DeepSeek-R1 distill for the reasoning path), offline toast,
installable PWA.
