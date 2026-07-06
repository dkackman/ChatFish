# ChatFish React Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ChatFish as a 100% client-side React 19 + TypeScript + Vite SPA at the repo root, at feature parity with the current Blazor app, then delete the dotnet projects.

**Architecture:** Pure-TS fish physics (direct port of `FishAnimation.cs`) driven by a fixed-step `requestAnimationFrame` loop that writes positions straight to DOM refs; React renders only structure and bubbles. web-llm runs in a Web Worker with streaming watchdogs and reasoning-model `<think>` parsing. Two zustand stores replace the C# event wiring.

**Tech Stack:** React 19, TypeScript, Vite, `@mlc-ai/web-llm`, zustand, `vite-plugin-pwa`, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-06-chatfish-react-rewrite-design.md`

## Global Constraints

- 100% client-side: no server calls except web-llm's own model-weight downloads.
- System prompt, verbatim: `You are ChatFish, a friendly fish that loves to chat with people. You are the color orange`
- Default model id: `Llama-3.2-1B-Instruct-q4f16_1-MLC`
- localStorage key for the selected model: `selectedModel`
- Generation params: `top_p: 0.95`, `repetition_penalty: 1.1`, `max_tokens: 4096`, temperature omitted, `stream: true`.
- Watchdogs: first token 30000 ms, inter-token 20000 ms; streamed-update throttle 60 ms.
- Physics tick: 50 ms fixed step. Bubble auto-hide: 25000 ms. Chat input `maxLength`: 45.
- AI fish: id `ai`, color Orange, scale "1.0". User fish: id `user`, color Blue, scale "0.9".
- Dead code from the Blazor app is NOT ported: `FishMessage.cs`, `LLMUsage.cs`, `FishColorExtensions.GetColorRgba` (and `FishColorTests`), `Ganss.Xss` sanitizer (React escapes text natively; `SanitizerReasoningTests` doesn't port).
- Commit messages: plain descriptive sentences matching repo style (e.g. "Add fish physics engine"), each ending with the Claude co-author trailer.
- If a pinned npm version is unavailable, use the latest stable release of that package.
- The existing Blazor sources under `ChatFish/` stay in place until Task 15 — earlier tasks copy CSS/assets from them.

---

### Task 1: Scaffold the Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`
- Create: `public/` (assets copied from `ChatFish/wwwroot/`)
- Modify: `.gitignore`

**Interfaces:**
- Produces: a running Vite app with `npm run dev`, `npm run build`, `npm test` all green; assets served from `public/`.

- [ ] **Step 1: Write project config files**

`package.json`:

```json
{
  "name": "chatfish",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@mlc-ai/web-llm": "^0.2.79",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zustand": "^5.0.5"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
    "jsdom": "^26.1.0",
    "typescript": "~5.8.3",
    "vite": "^7.0.0",
    "vite-plugin-pwa": "^1.0.0",
    "vitest": "^3.2.0"
  }
}
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

`index.html` (title matches the Blazor `<PageTitle>`; icons/preload ported from the old `wwwroot/index.html`):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preload" href="/images/background.jpg" as="image" type="image/jpeg" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
    <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
    <title>Fishy fishy fish</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (placeholder until Task 13):

```tsx
export default function App() {
  return <div>ChatFish</div>;
}
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 2: Copy static assets**

```bash
mkdir -p public
cp -R ChatFish/wwwroot/fish public/fish
cp -R ChatFish/wwwroot/images public/images
cp ChatFish/wwwroot/favicon.png ChatFish/wwwroot/icon-192.png ChatFish/wwwroot/icon-256.png ChatFish/wwwroot/icon-512.png public/
```

- [ ] **Step 3: Add node ignores to `.gitignore`**

Append to `.gitignore`:

```
# Vite / node
node_modules/
dist/
```

(`node_modules/` already appears once under the NTVS section; the explicit block is still clearer. Skip the duplicate if you prefer — either is fine.)

- [ ] **Step 4: Install and verify**

Run: `npm install`
Run: `npm run build` — Expected: succeeds, `dist/` created.
Run: `npm test` — Expected: passes ("no test files found" is OK via `--passWithNoTests`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json index.html src public .gitignore
git commit -m "Scaffold Vite + React + TypeScript app with copied static assets"
```

---

### Task 2: Geometry and velocity primitives

**Files:**
- Create: `src/engine/geometry.ts`
- Test: `src/engine/geometry.test.ts`

**Interfaces:**
- Produces:
  - `interface Point { left: number; top: number }`
  - `interface Size { width: number; height: number }`
  - `interface TankRect { width: number; height: number }`
  - `type Direction = "left" | "right"`
  - `type BubbleVerticalSide = "above" | "below"`
  - `interface Velocity { dx: number; dy: number }`
  - `direction(v: Velocity): Direction`, `otherDirection(v: Velocity): Velocity`, `translate(p: Point, v: Velocity): Point`

- [ ] **Step 1: Write the failing tests** (`src/engine/geometry.test.ts`, port of `VelocityTests.cs`)

```ts
import { describe, expect, it } from "vitest";
import { direction, otherDirection, translate } from "./geometry";

describe("velocity", () => {
  it("positive dx faces right", () => {
    expect(direction({ dx: 1.5, dy: 0 })).toBe("right");
  });

  it("negative dx faces left", () => {
    expect(direction({ dx: -1.5, dy: 0 })).toBe("left");
  });

  it("otherDirection flips horizontal, keeps vertical", () => {
    expect(otherDirection({ dx: 2.0, dy: 0.3 })).toEqual({ dx: -2.0, dy: 0.3 });
  });

  it("translate moves a point by the vector", () => {
    expect(translate({ left: 10, top: 20 }, { dx: 3, dy: -4 })).toEqual({ left: 13, top: 16 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/geometry.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (`src/engine/geometry.ts`)

```ts
export interface Point {
  left: number;
  top: number;
}

export interface Size {
  width: number;
  height: number;
}

// The only tank measurements the simulation needs; DOMRect satisfies it.
export interface TankRect {
  width: number;
  height: number;
}

export type Direction = "left" | "right";

export type BubbleVerticalSide = "above" | "below";

export interface Velocity {
  dx: number;
  dy: number;
}

export function direction(v: Velocity): Direction {
  return v.dx > 0 ? "right" : "left";
}

export function otherDirection(v: Velocity): Velocity {
  return { dx: -v.dx, dy: v.dy };
}

export function translate(p: Point, v: Velocity): Point {
  return { left: p.left + v.dx, top: p.top + v.dy };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/geometry.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/geometry.ts src/engine/geometry.test.ts
git commit -m "Add geometry and velocity primitives"
```

---

### Task 3: Fish physics (FishAnimation port)

**Files:**
- Create: `src/engine/fishAnimation.ts`
- Test: `src/engine/fishAnimation.test.ts`

**Interfaces:**
- Consumes: everything from `src/engine/geometry.ts`.
- Produces: `class FishAnimation` with fields `size: Size`, `position: Point`, `velocity: Velocity`, `enabled: boolean`, `hasSize: boolean`, `hasMessage: boolean`, `bubbleSize: Size`, `bubbleSide: BubbleVerticalSide` and methods `setSize(size: Size): void`, `setBubble(size: Size): void`, `clearBubble(): void`, `initializePosition(tank: TankRect): void`, `moveFish(p: Point): void`, `incrementPosition(tank: TankRect): void`.

- [ ] **Step 1: Write the failing tests** (`src/engine/fishAnimation.test.ts`, port of `FishAnimationTests.cs`)

```ts
import { describe, expect, it } from "vitest";
import { FishAnimation } from "./fishAnimation";
import { direction } from "./geometry";

const tank = { width: 800, height: 600 };

describe("FishAnimation", () => {
  it("initializePosition places the fish inside the tank", () => {
    for (let i = 0; i < 500; i++) {
      const animation = new FishAnimation();
      animation.initializePosition(tank);
      expect(animation.position.left).toBeGreaterThanOrEqual(0);
      expect(animation.position.left).toBeLessThanOrEqual(tank.width);
      expect(animation.position.top).toBeGreaterThanOrEqual(0);
      expect(animation.position.top).toBeLessThanOrEqual(tank.height);
    }
  });

  it("incrementPosition keeps the fish within the tank", () => {
    const size = 50;
    const animation = new FishAnimation();
    animation.initializePosition(tank);
    animation.setSize({ width: size, height: size });

    // tolerance > max per-step speed (~3.5) covers the single step before a bounce
    const tolerance = 10;
    for (let tick = 0; tick < 5000; tick++) {
      animation.incrementPosition(tank);
      expect(animation.position.left).toBeGreaterThanOrEqual(-tolerance);
      expect(animation.position.left).toBeLessThanOrEqual(tank.width - size + tolerance);
      expect(animation.position.top).toBeGreaterThanOrEqual(-tolerance);
      expect(animation.position.top).toBeLessThanOrEqual(tank.height - size + tolerance);
    }
  });

  it("setSize ignores zero-sized measurements", () => {
    const animation = new FishAnimation();
    animation.setSize({ width: 0, height: 0 });
    expect(animation.hasSize).toBe(false);

    animation.setSize({ width: 64, height: 48 });
    expect(animation.hasSize).toBe(true);
    expect(animation.size).toEqual({ width: 64, height: 48 });
  });

  it("moveFish updates position and reverses direction", () => {
    const animation = new FishAnimation();
    animation.initializePosition(tank);
    const original = direction(animation.velocity);

    animation.moveFish({ left: 123, top: 456 });

    expect(animation.position).toEqual({ left: 123, top: 456 });
    expect(direction(animation.velocity)).not.toBe(original);
  });

  it("setBubble ignores zero-sized measurements and clearBubble resets", () => {
    const animation = new FishAnimation();
    animation.setBubble({ width: 0, height: 0 });
    expect(animation.hasMessage).toBe(false);

    animation.setBubble({ width: 200, height: 120 });
    expect(animation.hasMessage).toBe(true);
    expect(animation.bubbleSize).toEqual({ width: 200, height: 120 });

    animation.clearBubble();
    expect(animation.hasMessage).toBe(false);
  });

  it("places the bubble below when there is no room above", () => {
    const animation = new FishAnimation();
    animation.initializePosition(tank);
    animation.setSize({ width: 50, height: 50 });
    animation.setBubble({ width: 200, height: 150 });

    animation.moveFish({ left: 400, top: 0 });
    animation.incrementPosition(tank);

    expect(animation.bubbleSide).toBe("below");
  });

  it("places the bubble above when room exists", () => {
    const animation = new FishAnimation();
    animation.initializePosition(tank);
    animation.setSize({ width: 50, height: 50 });
    animation.setBubble({ width: 200, height: 150 });

    animation.moveFish({ left: 400, top: 400 });
    animation.incrementPosition(tank);

    expect(animation.bubbleSide).toBe("above");
  });

  it("keeps a talking fish and its bubble within the tank", () => {
    const fish = 50;
    const bubbleWidth = 200;
    const animation = new FishAnimation();
    animation.initializePosition(tank);
    animation.setSize({ width: fish, height: fish });
    animation.setBubble({ width: bubbleWidth, height: 120 });

    const tolerance = 10;
    for (let tick = 0; tick < 5000; tick++) {
      animation.incrementPosition(tank);

      const centerX = animation.position.left + fish / 2;
      const facingRight = direction(animation.velocity) === "right";
      const leftExtent = facingRight ? animation.position.left : centerX - bubbleWidth;
      const rightExtent = facingRight ? centerX + bubbleWidth : animation.position.left + fish;

      expect(leftExtent).toBeGreaterThanOrEqual(-tolerance);
      expect(leftExtent).toBeLessThanOrEqual(tank.width);
      expect(rightExtent).toBeGreaterThanOrEqual(0);
      expect(rightExtent).toBeLessThanOrEqual(tank.width + tolerance);
    }
  });

  it("leaves bubbleSide at its default when not talking", () => {
    const animation = new FishAnimation();
    animation.initializePosition(tank);
    animation.setSize({ width: 50, height: 50 });

    animation.incrementPosition(tank);

    expect(animation.hasMessage).toBe(false);
    expect(animation.bubbleSide).toBe("above");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/fishAnimation.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (`src/engine/fishAnimation.ts` — line-for-line port of `ChatFish/Components/FishAnimation.cs`; keep the original's comments where they explain behavior)

```ts
import {
  direction,
  otherDirection,
  translate,
  type BubbleVerticalSide,
  type Direction,
  type Point,
  type Size,
  type TankRect,
  type Velocity,
} from "./geometry";

function randomVelocity(dir: Direction): Velocity {
  const modifier = dir === "right" ? 1 : -1;
  return { dx: (Math.random() * 3.0 + 0.5) * modifier, dy: (Math.random() - 0.5) * 0.5 };
}

export class FishAnimation {
  size: Size = { width: 0, height: 0 };
  position: Point = { left: 0, top: 0 };
  velocity: Velocity = { dx: 0, dy: 0 };
  enabled = true;

  // The fish size is measured from the DOM once (after its image has loaded) and
  // cached, so the animation loop needs no per-tick layout reads.
  hasSize = false;

  // Bubble state. The bubble is measured once per message (its size changes with
  // the text) and fed in via setBubble; the simulation then keeps the whole
  // talking ensemble on screen and reports where the bubble should be drawn.
  hasMessage = false;
  bubbleSize: Size = { width: 0, height: 0 };
  bubbleSide: BubbleVerticalSide = "above";

  setSize(size: Size): void {
    if (size.width > 0 && size.height > 0) {
      this.size = size;
      this.hasSize = true;
    }
  }

  setBubble(size: Size): void {
    if (size.width > 0 && size.height > 0) {
      this.bubbleSize = size;
      this.hasMessage = true;
    }
  }

  clearBubble(): void {
    this.hasMessage = false;
    this.bubbleSize = { width: 0, height: 0 };
  }

  initializePosition(tank: TankRect): void {
    // the 50 is buffer to keep the fish from being placed too close to the edge
    const left = (tank.width - 50.0) * Math.random();
    const top = (tank.height - 50.0) * Math.random();
    this.position = { left, top };
    this.velocity = randomVelocity(Math.random() < 0.5 ? "left" : "right");
  }

  // called when dragging the fish is complete
  moveFish(newPosition: Point): void {
    this.position = newPosition;
    this.velocity = randomVelocity(direction(otherDirection(this.velocity)));
  }

  // called on the animation loop; runs entirely on cached sizes and
  // tank-relative position (no layout reads).
  incrementPosition(tank: TankRect): void {
    const nextVelocity = this.getNextVelocity();
    const nextPosition = translate(this.position, this.velocity);

    this.velocity = this.adjustVelocityForBoundaries(nextVelocity, this.size, nextPosition, tank);
    this.position = translate(this.position, this.velocity);

    if (this.hasMessage) {
      this.bubbleSide = this.computeBubbleSide(this.position);
    }
  }

  private getNextVelocity(): Velocity {
    // randomly change direction and/or speed
    const changeDirection = Math.random() < 1 / 400;
    const changeSpeed = Math.random() < 1 / 300;
    const newDirectionVelocity = changeDirection ? otherDirection(this.velocity) : this.velocity;

    // always change speed if direction changed
    return changeSpeed || changeDirection
      ? randomVelocity(direction(newDirectionVelocity))
      : newDirectionVelocity;
  }

  private adjustVelocityForBoundaries(
    currentVelocity: Velocity,
    size: Size,
    nextPosition: Point,
    tank: TankRect,
  ): Velocity {
    // Position is tank-relative, so the tank spans (0, 0) to (width, height).
    // Vertical bounds use the fish box only; the bubble avoids vertical clipping
    // by flipping above/below (see computeBubbleSide).
    if (nextPosition.top <= 0) {
      currentVelocity = { dx: currentVelocity.dx, dy: Math.abs(currentVelocity.dy) };
    } else if (nextPosition.top + size.height >= tank.height) {
      currentVelocity = { dx: currentVelocity.dx, dy: -Math.abs(currentVelocity.dy) };
    }

    // Horizontal bounds: while talking, include the bubble that sits ahead of the
    // fish so the fish turns around before the bubble reaches a side wall.
    const { left, right } = this.horizontalExtent(nextPosition, size, direction(currentVelocity));
    if (left <= 0) {
      currentVelocity = { dx: Math.abs(currentVelocity.dx), dy: currentVelocity.dy };
    } else if (right >= tank.width) {
      currentVelocity = { dx: -Math.abs(currentVelocity.dx), dy: currentVelocity.dy };
    }

    return currentVelocity;
  }

  // The horizontal span the fish occupies. While talking this includes the
  // bubble, which extends from the fish centre outward in the facing direction.
  private horizontalExtent(position: Point, size: Size, dir: Direction): { left: number; right: number } {
    const fishLeft = position.left;
    const fishRight = position.left + size.width;
    if (!this.hasMessage) {
      return { left: fishLeft, right: fishRight };
    }

    const centerX = position.left + size.width / 2.0;
    return dir === "right"
      ? { left: fishLeft, right: centerX + this.bubbleSize.width }
      : { left: centerX - this.bubbleSize.width, right: fishRight };
  }

  // Which vertical side to draw the bubble on: above the fish when there is
  // room, else below.
  private computeBubbleSide(position: Point): BubbleVerticalSide {
    return position.top - this.bubbleSize.height < 0 ? "below" : "above";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/fishAnimation.test.ts` — Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/fishAnimation.ts src/engine/fishAnimation.test.ts
git commit -m "Port fish physics engine from FishAnimation.cs"
```

---

### Task 4: Chat message model

**Files:**
- Create: `src/state/chatMessage.ts`
- Test: `src/state/chatMessage.test.ts`

**Interfaces:**
- Produces:
  - `interface ChatMessage { message: string; modifier: string; reasoning: string }`
  - `THINKING_MODIFIER = "thinking"`, `COMMANDS: Record<string,string>`, `EMOTES: Record<string,string>`
  - `emptyMessage(): ChatMessage`, `fromMessage(text: string): ChatMessage`, `fromReply(reply: string): ChatMessage`, `thinking(reasoning?: string): ChatMessage`
  - `isCommand(m): boolean`, `isThinking(m): boolean`, `isEmpty(m): boolean`, `messagesEqual(a, b): boolean`

- [ ] **Step 1: Write the failing tests** (`src/state/chatMessage.test.ts`, port of `ChatMessageTests.cs`)

```ts
import { describe, expect, it } from "vitest";
import { fromMessage, isCommand, isEmpty, messagesEqual } from "./chatMessage";

describe("fromMessage", () => {
  it("plain text has no modifier", () => {
    const m = fromMessage("hello there");
    expect(m.message).toBe("hello there");
    expect(m.modifier).toBe("");
    expect(isCommand(m)).toBe(false);
    expect(isEmpty(m)).toBe(false);
  });

  it("plain text is trimmed", () => {
    expect(fromMessage("   spaced   ").message).toBe("spaced");
  });

  it("command with argument splits modifier and message", () => {
    const m = fromMessage("/shout hello world");
    expect(m.modifier).toBe("shout");
    expect(m.message).toBe("hello world");
  });

  it("command without argument has empty message", () => {
    const m = fromMessage("/help");
    expect(m.modifier).toBe("help");
    expect(m.message).toBe("");
  });

  it("modifier is lowercased", () => {
    expect(fromMessage("/HELP").modifier).toBe("help");
  });

  it.each(["about", "help", "llm"])("isCommand is true for /%s", (command) => {
    expect(isCommand(fromMessage(`/${command}`))).toBe(true);
  });

  it.each(["shout", "whisper"])("emote /%s is not a command", (emote) => {
    const m = fromMessage(`/${emote} hi`);
    expect(isCommand(m)).toBe(false);
    expect(m.modifier).toBe(emote);
  });

  it.each(["", "   ", "/"])("isEmpty is true for %j", (input) => {
    expect(isEmpty(fromMessage(input))).toBe(true);
  });

  it("equality matches on message and modifier", () => {
    const a = fromMessage("/shout hi");
    const b = fromMessage("/shout hi");
    const c = fromMessage("/whisper hi");
    expect(messagesEqual(a, b)).toBe(true);
    expect(messagesEqual(a, c)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/chatMessage.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (`src/state/chatMessage.ts`)

```ts
// Modifier value for the transient "the model is thinking" bubble. It carries
// no text of its own; MessageBubble renders an animated indicator instead.
export const THINKING_MODIFIER = "thinking";

export interface ChatMessage {
  message: string;
  modifier: string;
  // A live peek at a reasoning model's chain-of-thought, shown under the
  // thinking indicator. Only meaningful while isThinking.
  reasoning: string;
}

export const COMMANDS: Readonly<Record<string, string>> = {
  about: "Show the about page",
  help: "Display this help",
  llm: "Configure the LLM",
};

export const EMOTES: Readonly<Record<string, string>> = {
  shout: "Shout a chat message",
  whisper: "Whisper a chat message",
};

export function emptyMessage(): ChatMessage {
  return { message: "", modifier: "", reasoning: "" };
}

export function fromMessage(text: string): ChatMessage {
  const trimmed = text.trim();
  if (trimmed.startsWith("/")) {
    // "/command argument..." — everything after the first space is the message
    const spaceIdx = trimmed.indexOf(" ");
    const modifier = (spaceIdx < 0 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase();
    const message = spaceIdx < 0 ? "" : trimmed.slice(spaceIdx + 1);
    return { message, modifier, reasoning: "" };
  }
  return { message: trimmed, modifier: "", reasoning: "" };
}

// Wraps raw model output as a plain reply. Unlike fromMessage it does no
// command/emote parsing, so a reply that happens to start with '/' is shown
// verbatim rather than being misread as a command.
export function fromReply(reply: string): ChatMessage {
  return { message: reply, modifier: "", reasoning: "" };
}

// A "thinking" bubble shown while awaiting the model's answer. The optional
// reasoning is streamed underneath the animated indicator.
export function thinking(reasoning = ""): ChatMessage {
  return { message: "", modifier: THINKING_MODIFIER, reasoning };
}

export function isCommand(m: ChatMessage): boolean {
  return Object.hasOwn(COMMANDS, m.modifier);
}

export function isThinking(m: ChatMessage): boolean {
  return m.modifier === THINKING_MODIFIER;
}

export function isEmpty(m: ChatMessage): boolean {
  return m.message.trim() === "" && m.modifier.trim() === "";
}

export function messagesEqual(a: ChatMessage, b: ChatMessage): boolean {
  return a.message === b.message && a.modifier === b.modifier && a.reasoning === b.reasoning;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/chatMessage.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/chatMessage.ts src/state/chatMessage.test.ts
git commit -m "Port chat message model with commands and emotes"
```

---

### Task 5: Reasoning parser

**Files:**
- Create: `src/state/reasoningParser.ts`
- Test: `src/state/reasoningParser.test.ts`

**Interfaces:**
- Produces: `interface ReasoningResult { reasoning: string; answer: string; isReasoning: boolean }`, `parseReasoning(content: string | null | undefined): ReasoningResult`, `peek(reasoning: string, maxLength?: number): string` (default 180).

- [ ] **Step 1: Write the failing tests** (`src/state/reasoningParser.test.ts`, port of `ReasoningParserTests.cs`)

```ts
import { describe, expect, it } from "vitest";
import { parseReasoning, peek } from "./reasoningParser";

describe("parseReasoning", () => {
  it("plain text is the answer with no reasoning", () => {
    expect(parseReasoning("The answer is 4.")).toEqual({
      reasoning: "",
      answer: "The answer is 4.",
      isReasoning: false,
    });
  });

  it("open think block mid-stream is reasoning with no answer", () => {
    expect(parseReasoning("<think>Okay, the user wants the sum")).toEqual({
      reasoning: "Okay, the user wants the sum",
      answer: "",
      isReasoning: true,
    });
  });

  it("closed think block splits reasoning from answer", () => {
    expect(parseReasoning("<think>2 plus 2 is 4.</think>\n\nThe answer is 4.")).toEqual({
      reasoning: "2 plus 2 is 4.",
      answer: "The answer is 4.",
      isReasoning: false,
    });
  });

  it("closed block without open tag treats leading text as reasoning", () => {
    // Some templates prefill the opening <think>, so only the close streams.
    expect(parseReasoning("reasoning here</think>the answer")).toEqual({
      reasoning: "reasoning here",
      answer: "the answer",
      isReasoning: false,
    });
  });

  it("just-closed think block has no answer yet", () => {
    const result = parseReasoning("<think>done thinking</think>");
    expect(result.isReasoning).toBe(false);
    expect(result.answer).toBe("");
  });
});

describe("peek", () => {
  it("returns the tail of long reasoning", () => {
    const reasoning = "a".repeat(100) + "TAIL";
    expect(peek(reasoning, 10)).toBe("…aaaaaaTAIL");
  });

  it("returns short reasoning whole, trimmed", () => {
    expect(peek("  short thought  ", 180)).toBe("short thought");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/reasoningParser.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (`src/state/reasoningParser.ts`)

```ts
// Reasoning models (e.g. DeepSeek-R1 distills) stream their chain-of-thought
// wrapped in <think>...</think> before the actual answer, all in one content
// stream. This splits an accumulated stream into the reasoning (shown as a live
// "thinking" peek) and the answer (shown as the reply).
const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

export interface ReasoningResult {
  reasoning: string;
  answer: string;
  isReasoning: boolean;
}

export function parseReasoning(content: string | null | undefined): ReasoningResult {
  const text = content ?? "";

  const closeIdx = text.indexOf(CLOSE_TAG);
  if (closeIdx >= 0) {
    // Reasoning is complete; everything after </think> is the answer.
    const reasoning = stripOpenTag(text.slice(0, closeIdx)).trim();
    const answer = text.slice(closeIdx + CLOSE_TAG.length).trimStart();
    return { reasoning, answer, isReasoning: false };
  }

  const openIdx = text.indexOf(OPEN_TAG);
  if (openIdx >= 0) {
    // Mid-reasoning: no closing tag yet, so there is no answer to show.
    return { reasoning: text.slice(openIdx + OPEN_TAG.length).trim(), answer: "", isReasoning: true };
  }

  // No reasoning markup at all: an ordinary model, or an answer-only stream.
  return { reasoning: "", answer: text, isReasoning: false };
}

// Only the tail of the (possibly very long) chain-of-thought, so the bubble
// reads as a single live, moving thought rather than a growing wall of text.
export function peek(reasoning: string, maxLength = 180): string {
  const trimmed = reasoning.trim();
  return trimmed.length <= maxLength ? trimmed : "…" + trimmed.slice(-maxLength);
}

function stripOpenTag(reasoning: string): string {
  const openIdx = reasoning.indexOf(OPEN_TAG);
  return openIdx >= 0 ? reasoning.slice(openIdx + OPEN_TAG.length) : reasoning;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/reasoningParser.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/reasoningParser.ts src/state/reasoningParser.test.ts
git commit -m "Port reasoning parser for think-tag streams"
```

---

### Task 6: Fish tank store

**Files:**
- Create: `src/state/fishStore.ts`
- Test: `src/state/fishStore.test.ts`

**Interfaces:**
- Consumes: `ChatMessage`, `emptyMessage`, `isEmpty`, `messagesEqual` from `./chatMessage`.
- Produces:
  - `type FishColor = "Blue" | "Green" | "Orange" | "Pink" | "Yellow" | "Red"`
  - `interface FishData { id: string; color: FishColor; scale: string; message: ChatMessage; isMessageVisible: boolean }`
  - `interface Toast { title: string; caption: string; messages?: string[] }`
  - `AI_FISH_ID = "ai"`, `USER_FISH_ID = "user"`, `MESSAGE_VISIBILITY_MS = 25000`
  - `useFishStore` (zustand) with state `{ fish: Record<string, FishData>; toast: Toast | null; isSettingsVisible: boolean; isOffline: boolean }` and actions `setFishMessage(id, message)`, `showToast(toast)`, `closeToast()`, `openSettings()`, `closeSettings()`, `setOffline(offline)`.

- [ ] **Step 1: Write the failing tests** (`src/state/fishStore.test.ts`, port of `FishStateTests.cs`; `vi.resetModules` gives each test a fresh store)

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function load() {
  return await import("./fishStore");
}

describe("fishStore", () => {
  it("starts with ai and user fish, empty and hidden", async () => {
    const { useFishStore, AI_FISH_ID, USER_FISH_ID } = await load();
    const { fish } = useFishStore.getState();

    expect(fish[AI_FISH_ID]).toMatchObject({ color: "Orange", scale: "1.0", isMessageVisible: false });
    expect(fish[USER_FISH_ID]).toMatchObject({ color: "Blue", scale: "0.9", isMessageVisible: false });
  });

  it("setting a message makes it visible", async () => {
    const { useFishStore, AI_FISH_ID } = await load();
    const { fromMessage } = await import("./chatMessage");

    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));

    const fish = useFishStore.getState().fish[AI_FISH_ID];
    expect(fish.isMessageVisible).toBe(true);
    expect(fish.message.message).toBe("hello");
  });

  it("setting an equal message does not notify subscribers again", async () => {
    const { useFishStore, AI_FISH_ID } = await load();
    const { fromMessage } = await import("./chatMessage");
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));

    let changes = 0;
    const unsubscribe = useFishStore.subscribe(() => changes++);
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));
    unsubscribe();

    expect(changes).toBe(0);
  });

  it("clearing the message hides it", async () => {
    const { useFishStore, AI_FISH_ID } = await load();
    const { fromMessage, emptyMessage } = await import("./chatMessage");
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));

    useFishStore.getState().setFishMessage(AI_FISH_ID, emptyMessage());

    expect(useFishStore.getState().fish[AI_FISH_ID].isMessageVisible).toBe(false);
  });

  it("hides the message after the visibility timeout", async () => {
    const { useFishStore, AI_FISH_ID, MESSAGE_VISIBILITY_MS } = await load();
    const { fromMessage } = await import("./chatMessage");
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("hello"));

    vi.advanceTimersByTime(MESSAGE_VISIBILITY_MS);

    const fish = useFishStore.getState().fish[AI_FISH_ID];
    expect(fish.isMessageVisible).toBe(false);
    expect(fish.message.message).toBe("hello"); // message kept, just hidden
  });

  it("a new message restarts the visibility timer", async () => {
    const { useFishStore, AI_FISH_ID, MESSAGE_VISIBILITY_MS } = await load();
    const { fromMessage } = await import("./chatMessage");
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("one"));

    vi.advanceTimersByTime(MESSAGE_VISIBILITY_MS - 1000);
    useFishStore.getState().setFishMessage(AI_FISH_ID, fromMessage("two"));
    vi.advanceTimersByTime(MESSAGE_VISIBILITY_MS - 1000);

    expect(useFishStore.getState().fish[AI_FISH_ID].isMessageVisible).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/fishStore.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (`src/state/fishStore.ts`)

```ts
import { create } from "zustand";
import { emptyMessage, isEmpty, messagesEqual, type ChatMessage } from "./chatMessage";

export type FishColor = "Blue" | "Green" | "Orange" | "Pink" | "Yellow" | "Red";

export interface FishData {
  id: string;
  color: FishColor;
  scale: string;
  message: ChatMessage;
  isMessageVisible: boolean;
}

export interface Toast {
  title: string;
  caption: string;
  messages?: string[];
}

export const AI_FISH_ID = "ai";
export const USER_FISH_ID = "user";
export const MESSAGE_VISIBILITY_MS = 25000;

interface FishTankState {
  fish: Record<string, FishData>;
  toast: Toast | null;
  isSettingsVisible: boolean;
  isOffline: boolean;
  setFishMessage(id: string, message: ChatMessage): void;
  showToast(toast: Toast): void;
  closeToast(): void;
  openSettings(): void;
  closeSettings(): void;
  setOffline(offline: boolean): void;
}

// Bubble auto-hide timers, one per fish; not reactive state.
const hideTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useFishStore = create<FishTankState>((set, get) => ({
  fish: {
    [AI_FISH_ID]: { id: AI_FISH_ID, color: "Orange", scale: "1.0", message: emptyMessage(), isMessageVisible: false },
    [USER_FISH_ID]: { id: USER_FISH_ID, color: "Blue", scale: "0.9", message: emptyMessage(), isMessageVisible: false },
  },
  toast: null,
  // The settings dialog is visible on startup, matching the Blazor app.
  isSettingsVisible: true,
  isOffline: false,

  setFishMessage(id, message) {
    const current = get().fish[id];
    // Ignore unknown fish and equal values so subscribers aren't churned needlessly.
    if (!current || messagesEqual(current.message, message)) {
      return;
    }

    const visible = !isEmpty(message);
    clearTimeout(hideTimers.get(id));
    if (visible) {
      hideTimers.set(
        id,
        setTimeout(() => {
          set((s) => ({ fish: { ...s.fish, [id]: { ...s.fish[id], isMessageVisible: false } } }));
        }, MESSAGE_VISIBILITY_MS),
      );
    }

    set((s) => ({ fish: { ...s.fish, [id]: { ...s.fish[id], message, isMessageVisible: visible } } }));
  },

  showToast(toast) {
    set({ toast });
  },
  closeToast() {
    set({ toast: null });
  },
  openSettings() {
    set({ isSettingsVisible: true });
  },
  closeSettings() {
    set({ isSettingsVisible: false });
  },
  setOffline(offline) {
    set({ isOffline: offline });
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/fishStore.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/fishStore.ts src/state/fishStore.test.ts
git commit -m "Add fish tank store with bubble visibility timers"
```

---

### Task 7: Streaming generation with watchdogs

**Files:**
- Create: `src/llm/generation.ts`, `src/llm/worker.ts`
- Test: `src/llm/generation.test.ts`

**Interfaces:**
- Produces:
  - `interface LlmMessage { role: "system" | "user" | "assistant"; content: string }`
  - `interface GenerationCallbacks { onUpdate(partial: string): void; onFinish(final: string): void; onError(message: string): void }`
  - `interface GenerationEngine` (structural subset of the web-llm engine: `chat.completions.create(...)` returning an async iterable of chunks, plus `interruptGenerate()`)
  - `generate(engine: GenerationEngine, messages: LlmMessage[], callbacks: GenerationCallbacks): Promise<void>`
  - Constants `FIRST_TOKEN_TIMEOUT_MS = 30000`, `INTER_TOKEN_TIMEOUT_MS = 20000`, `UPDATE_THROTTLE_MS = 60`

- [ ] **Step 1: Write `src/llm/worker.ts`** (direct port of `worker.js`)

```ts
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
```

- [ ] **Step 2: Write the failing tests** (`src/llm/generation.test.ts`)

```ts
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

function makeEngine(stream: AsyncIterable<CompletionChunk>): GenerationEngine & { interrupted: boolean } {
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/llm/generation.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implement** (`src/llm/generation.ts` — port of `generating()` in `chatfish-llm.js`)

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/llm/generation.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/llm/generation.ts src/llm/generation.test.ts src/llm/worker.ts
git commit -m "Add streaming LLM generation with stall watchdogs and web worker"
```

---

### Task 8: LLM engine module (transcript, init, model queries)

**Files:**
- Create: `src/llm/engine.ts`
- Test: `src/llm/engine.test.ts`

**Interfaces:**
- Consumes: `generate`, `GenerationCallbacks`, `GenerationEngine`, `LlmMessage` from `./generation`; `parseReasoning` from `../state/reasoningParser`; `@mlc-ai/web-llm` (`prebuiltAppConfig`, `hasModelInCache`, `CreateWebWorkerMLCEngine`).
- Produces:
  - `DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC"`
  - `getAvailableModels(): string[]`
  - `getDownloadedModels(): Promise<string[]>`
  - `resetEngine(): void`
  - `initializeEngine(modelId: string, onProgress: (text: string, progress: number) => void, onError: (message: string) => void): Promise<string | null>`
  - `sendChatMessage(text: string, callbacks: GenerationCallbacks): Promise<void>` — throws if no engine is loaded.

- [ ] **Step 1: Write the failing tests** (`src/llm/engine.test.ts`; `vi.resetModules` gives each test fresh module state)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompletionChunk } from "./generation";

const fakeEngine = {
  chat: {
    completions: {
      create: vi.fn(async () =>
        (async function* (): AsyncGenerator<CompletionChunk> {
          yield { choices: [{ delta: { content: "<think>hmm</think>fish reply" } }] };
        })(),
      ),
    },
  },
  interruptGenerate: vi.fn(),
};

vi.mock("@mlc-ai/web-llm", () => ({
  prebuiltAppConfig: { model_list: [{ model_id: "model-a" }, { model_id: "model-b" }] },
  hasModelInCache: vi.fn(async (id: string) => id === "model-a"),
  CreateWebWorkerMLCEngine: vi.fn(async () => fakeEngine),
}));

beforeEach(() => {
  vi.resetModules();
  // jsdom has no Worker; engine.ts constructs one to hand to web-llm (mocked above).
  vi.stubGlobal("Worker", class { constructor() {} });
});

async function load() {
  return await import("./engine");
}

const noProgress = () => {};
const noError = () => {};

describe("engine", () => {
  it("lists available models from the prebuilt config", async () => {
    const engine = await load();
    expect(engine.getAvailableModels()).toEqual(["model-a", "model-b"]);
  });

  it("lists only cached models as downloaded", async () => {
    const engine = await load();
    expect(await engine.getDownloadedModels()).toEqual(["model-a"]);
  });

  it("initializeEngine loads and reports the model id", async () => {
    const engine = await load();
    expect(await engine.initializeEngine("model-a", noProgress, noError)).toBe("model-a");
  });

  it("initializeEngine reports failures and returns null", async () => {
    const webllm = await import("@mlc-ai/web-llm");
    vi.mocked(webllm.CreateWebWorkerMLCEngine).mockRejectedValueOnce(new Error("no gpu"));
    const engine = await load();
    const errors: string[] = [];

    const result = await engine.initializeEngine("model-a", noProgress, (m) => errors.push(m));

    expect(result).toBeNull();
    expect(errors[0]).toContain("There was an error downloading this model.");
    expect(errors[0]).toContain("no gpu");
  });

  it("sendChatMessage throws when no engine is loaded", async () => {
    const engine = await load();
    await expect(
      engine.sendChatMessage("hi", { onUpdate: noProgress, onFinish: noProgress, onError: noError }),
    ).rejects.toThrow("WebLLM engine is not initialized");
  });

  it("sends the transcript and persists only the parsed answer", async () => {
    const engine = await load();
    await engine.initializeEngine("model-a", noProgress, noError);
    const finals: string[] = [];

    await engine.sendChatMessage("hello fish", {
      onUpdate: noProgress,
      onFinish: (f) => finals.push(f),
      onError: noError,
    });

    // onFinish gets the raw final (including <think>), transcript keeps the answer only
    expect(finals).toEqual(["<think>hmm</think>fish reply"]);
    const sent = fakeEngine.chat.completions.create.mock.calls[0][0].messages;
    expect(sent[0]).toEqual({
      role: "system",
      content: "You are ChatFish, a friendly fish that loves to chat with people. You are the color orange",
    });
    expect(sent[1]).toEqual({ role: "user", content: "hello fish" });

    // A second turn's request includes the prior assistant answer (no <think>)
    await engine.sendChatMessage("again", {
      onUpdate: noProgress,
      onFinish: noProgress,
      onError: noError,
    });
    const second = fakeEngine.chat.completions.create.mock.calls[1][0].messages;
    expect(second[2]).toEqual({ role: "assistant", content: "fish reply" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/llm/engine.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (`src/llm/engine.ts`)

```ts
import * as webllm from "@mlc-ai/web-llm";
import { parseReasoning } from "../state/reasoningParser";
import { generate, type GenerationCallbacks, type GenerationEngine, type LlmMessage } from "./generation";

export const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

const SYSTEM_PROMPT =
  "You are ChatFish, a friendly fish that loves to chat with people. You are the color orange";

let engine: GenerationEngine | undefined;
let loadedModel: string | null = null;
const transcript: LlmMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

export function getAvailableModels(): string[] {
  return webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
}

// Ids of models whose weights are already cached locally. web-llm tracks this
// in the browser Cache Storage, so we don't keep a parallel list.
export async function getDownloadedModels(): Promise<string[]> {
  const ids = getAvailableModels();
  const cached = await Promise.all(
    ids.map(async (id) => ((await webllm.hasModelInCache(id, webllm.prebuiltAppConfig)) ? id : null)),
  );
  return cached.filter((id): id is string => id !== null);
}

export function resetEngine(): void {
  engine = undefined;
  loadedModel = null;
}

// Returns the id of the model now loaded in the engine, or null if loading failed.
export async function initializeEngine(
  modelId: string,
  onProgress: (text: string, progress: number) => void,
  onError: (message: string) => void,
): Promise<string | null> {
  if (!engine) {
    try {
      const created = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
        modelId,
        { initProgressCallback: (report) => onProgress(report.text, report.progress) },
      );
      // The web-llm engine satisfies GenerationEngine structurally; the cast
      // avoids coupling our narrow interface to web-llm's full request types.
      engine = created as unknown as GenerationEngine;
      loadedModel = modelId;
    } catch (error) {
      onError("There was an error downloading this model. \n\n" + String(error));
      return null;
    }
  }
  return loadedModel;
}

export async function sendChatMessage(text: string, callbacks: GenerationCallbacks): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  if (!engine) {
    throw new Error("WebLLM engine is not initialized");
  }

  transcript.push({ role: "user", content: trimmed });

  await generate(engine, transcript, {
    onUpdate: callbacks.onUpdate,
    onFinish(final) {
      // Persist only the answer in history. A reasoning model's <think> chain-
      // of-thought must not be replayed into later turns: it bloats the context
      // window and these models are trained to condition on prior answers only.
      transcript.push({ role: "assistant", content: parseReasoning(final).answer });
      callbacks.onFinish(final);
    },
    onError: callbacks.onError,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/llm/engine.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/engine.ts src/llm/engine.test.ts
git commit -m "Add LLM engine module with transcript and model cache queries"
```

---

### Task 9: LLM store

**Files:**
- Create: `src/state/llmStore.ts`
- Test: `src/state/llmStore.test.ts`

**Interfaces:**
- Consumes: `src/llm/engine.ts` (all exports), `useFishStore`/`AI_FISH_ID` from `./fishStore`, `fromReply` from `./chatMessage`.
- Produces: `SELECTED_MODEL_STORAGE_KEY = "selectedModel"` and `useLlmStore` (zustand) with state `{ availableModels: string[]; downloadedModels: string[]; selectedModel: string; loadedModel: string | null; progressText: string; progressValue: number; isProgressVisible: boolean }` and actions `initialize(): Promise<void>`, `selectModel(modelId: string): void`, `loadEngine(): Promise<void>`.

- [ ] **Step 1: Write the failing tests** (`src/state/llmStore.test.ts`)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../llm/engine", () => ({
  DEFAULT_MODEL: "model-a",
  getAvailableModels: vi.fn(() => ["model-a", "model-b"]),
  getDownloadedModels: vi.fn(async () => ["model-a"]),
  resetEngine: vi.fn(),
  initializeEngine: vi.fn(async () => "model-b"),
  sendChatMessage: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
});

async function load() {
  return await import("./llmStore");
}

describe("llmStore", () => {
  it("initialize populates models and restores the saved selection", async () => {
    localStorage.setItem("selectedModel", "model-b");
    const { useLlmStore } = await load();

    await useLlmStore.getState().initialize();

    const state = useLlmStore.getState();
    expect(state.availableModels).toEqual(["model-a", "model-b"]);
    expect(state.downloadedModels).toEqual(["model-a"]);
    expect(state.selectedModel).toBe("model-b");
  });

  it("selectModel rejects unknown models", async () => {
    const { useLlmStore } = await load();
    await useLlmStore.getState().initialize();

    useLlmStore.getState().selectModel("bogus");

    expect(useLlmStore.getState().selectedModel).toBe("model-a");
    expect(localStorage.getItem("selectedModel")).toBeNull();
  });

  it("selectModel persists a valid selection", async () => {
    const { useLlmStore } = await load();
    await useLlmStore.getState().initialize();

    useLlmStore.getState().selectModel("model-b");

    expect(localStorage.getItem("selectedModel")).toBe("model-b");
  });

  it("loadEngine resets, loads, and refreshes downloaded models", async () => {
    const llm = await import("../llm/engine");
    const { useLlmStore } = await load();
    await useLlmStore.getState().initialize();
    useLlmStore.getState().selectModel("model-b");

    await useLlmStore.getState().loadEngine();

    expect(llm.resetEngine).toHaveBeenCalled();
    expect(llm.initializeEngine).toHaveBeenCalledWith("model-b", expect.any(Function), expect.any(Function));
    expect(useLlmStore.getState().loadedModel).toBe("model-b");
    expect(useLlmStore.getState().isProgressVisible).toBe(true);
  });

  it("loadEngine errors surface in the progress text and the AI bubble", async () => {
    const llm = await import("../llm/engine");
    vi.mocked(llm.initializeEngine).mockImplementationOnce(async (_m, _p, onError) => {
      onError("There was an error downloading this model.");
      return null;
    });
    const { useLlmStore } = await load();
    const { useFishStore, AI_FISH_ID } = await import("./fishStore");
    await useLlmStore.getState().initialize();

    await useLlmStore.getState().loadEngine();

    expect(useLlmStore.getState().loadedModel).toBeNull();
    expect(useLlmStore.getState().progressText).toContain("error downloading");
    expect(useFishStore.getState().fish[AI_FISH_ID].message.message).toContain("error downloading");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/llmStore.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (`src/state/llmStore.ts`)

```ts
import { create } from "zustand";
import * as llm from "../llm/engine";
import { fromReply } from "./chatMessage";
import { AI_FISH_ID, useFishStore } from "./fishStore";

export const SELECTED_MODEL_STORAGE_KEY = "selectedModel";

interface LlmState {
  availableModels: string[];
  downloadedModels: string[];
  selectedModel: string;
  loadedModel: string | null;
  progressText: string;
  progressValue: number; // 0..1
  isProgressVisible: boolean;
  initialize(): Promise<void>;
  selectModel(modelId: string): void;
  loadEngine(): Promise<void>;
}

export const useLlmStore = create<LlmState>((set, get) => ({
  availableModels: [llm.DEFAULT_MODEL],
  downloadedModels: [],
  selectedModel: llm.DEFAULT_MODEL,
  loadedModel: null,
  progressText: "",
  progressValue: 0,
  isProgressVisible: false,

  async initialize() {
    try {
      set({ availableModels: llm.getAvailableModels() });
      set({ downloadedModels: await llm.getDownloadedModels() });
    } catch (error) {
      console.warn("Failed to query models; using default.", error);
    }
    // localStorage returns null on first visit; only restore a previously
    // saved model so an invalid value is never selected.
    const saved = localStorage.getItem(SELECTED_MODEL_STORAGE_KEY);
    if (saved) {
      get().selectModel(saved);
    }
  },

  selectModel(modelId) {
    if (modelId && get().availableModels.includes(modelId)) {
      localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId);
      set({ selectedModel: modelId });
    } else {
      console.warn(`Invalid model selected: ${modelId}`);
    }
  },

  async loadEngine() {
    llm.resetEngine();
    set({
      loadedModel: null,
      isProgressVisible: true,
      progressText: "Initializing WebLLM engine...",
      progressValue: 0,
    });

    const onProgress = (text: string, progress: number) => set({ progressText: text, progressValue: progress });
    // Init/download failures show in the dialog status AND the AI fish bubble,
    // matching the Blazor app's MessageError fan-out.
    const onError = (message: string) => {
      set({ progressText: message, progressValue: 0 });
      useFishStore.getState().setFishMessage(AI_FISH_ID, fromReply(message));
    };

    const loaded = await llm.initializeEngine(get().selectedModel, onProgress, onError);
    // The model is now cached; refresh so the dropdown shows its marker.
    set({ loadedModel: loaded, downloadedModels: await llm.getDownloadedModels() });
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/llmStore.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/llmStore.ts src/state/llmStore.test.ts
git commit -m "Add LLM store for model selection, loading, and progress"
```

---

### Task 10: Message dispatcher

**Files:**
- Create: `src/state/dispatcher.ts`
- Test: `src/state/dispatcher.test.ts`

**Interfaces:**
- Consumes: `chatMessage.ts`, `reasoningParser.ts`, `fishStore.ts`, `sendChatMessage` from `../llm/engine`.
- Produces: `dispatchMessage(text: string): Promise<void>`, constants `ABOUT_URL`, `EMPTY_REPLY_FALLBACK`, `NO_MODEL_MESSAGE`.

- [ ] **Step 1: Write the failing tests** (`src/state/dispatcher.test.ts`, port of `MessageDispatcherTests.cs` plus the FishTankClient streaming behavior)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationCallbacks } from "../llm/generation";

vi.mock("../llm/engine", () => ({
  sendChatMessage: vi.fn(async () => {}),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

async function load() {
  const dispatcher = await import("./dispatcher");
  const fishStore = await import("./fishStore");
  const llm = await import("../llm/engine");
  return { ...dispatcher, ...fishStore, llm };
}

describe("dispatchMessage", () => {
  it.each(["", "   ", "/"])("ignores empty input %j", async (input) => {
    const { dispatchMessage, useFishStore, llm } = await load();
    const before = useFishStore.getState();

    await dispatchMessage(input);

    expect(llm.sendChatMessage).not.toHaveBeenCalled();
    expect(useFishStore.getState()).toBe(before); // no state change at all
  });

  it("/help raises a toast listing commands and emotes", async () => {
    const { dispatchMessage, useFishStore } = await load();

    await dispatchMessage("/help");

    const toast = useFishStore.getState().toast;
    expect(toast?.title).toBe("Help");
    expect(toast?.messages?.some((m) => m.startsWith("/help"))).toBe(true);
    expect(toast?.messages?.some((m) => m.startsWith("/about"))).toBe(true);
    expect(toast?.messages?.some((m) => m.startsWith("/shout"))).toBe(true); // emote listed too
  });

  it("/about opens the GitHub repo", async () => {
    const { dispatchMessage, ABOUT_URL } = await load();
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    await dispatchMessage("/about");

    expect(open).toHaveBeenCalledWith(ABOUT_URL, "_blank");
  });

  it("/llm opens the settings dialog", async () => {
    const { dispatchMessage, useFishStore } = await load();
    useFishStore.getState().closeSettings();

    await dispatchMessage("/llm");

    expect(useFishStore.getState().isSettingsVisible).toBe(true);
  });

  it("a plain message shows the user bubble, an AI thinking bubble, and reaches the LLM", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID, USER_FISH_ID } = await load();

    await dispatchMessage("hello fish");

    expect(llm.sendChatMessage).toHaveBeenCalledWith("hello fish", expect.any(Object));
    expect(useFishStore.getState().fish[USER_FISH_ID].message.message).toBe("hello fish");
    expect(useFishStore.getState().fish[AI_FISH_ID].message.modifier).toBe("thinking");
  });

  it("an emote is sent to the LLM, not treated as a command", async () => {
    const { dispatchMessage, useFishStore, llm, USER_FISH_ID } = await load();

    await dispatchMessage("/shout hello");

    expect(llm.sendChatMessage).toHaveBeenCalledWith("hello", expect.any(Object));
    expect(useFishStore.getState().fish[USER_FISH_ID].message.modifier).toBe("shout");
    expect(useFishStore.getState().toast).toBeNull();
  });

  it("streaming reasoning keeps the thinking bubble with a live peek", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID } = await load();
    let callbacks: GenerationCallbacks | undefined;
    vi.mocked(llm.sendChatMessage).mockImplementation(async (_t, cb) => {
      callbacks = cb;
    });

    await dispatchMessage("question");
    callbacks!.onUpdate("<think>pondering the deep");

    const ai = useFishStore.getState().fish[AI_FISH_ID];
    expect(ai.message.modifier).toBe("thinking");
    expect(ai.message.reasoning).toBe("pondering the deep");
  });

  it("streaming answer text replaces the thinking bubble", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID } = await load();
    let callbacks: GenerationCallbacks | undefined;
    vi.mocked(llm.sendChatMessage).mockImplementation(async (_t, cb) => {
      callbacks = cb;
    });

    await dispatchMessage("question");
    callbacks!.onUpdate("<think>done</think>Here you go");

    expect(useFishStore.getState().fish[AI_FISH_ID].message.message).toBe("Here you go");
  });

  it("an empty final answer falls back to a friendly note", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID, EMPTY_REPLY_FALLBACK } = await load();
    let callbacks: GenerationCallbacks | undefined;
    vi.mocked(llm.sendChatMessage).mockImplementation(async (_t, cb) => {
      callbacks = cb;
    });

    await dispatchMessage("question");
    callbacks!.onFinish("<think>only thoughts</think>");

    expect(useFishStore.getState().fish[AI_FISH_ID].message.message).toBe(EMPTY_REPLY_FALLBACK);
  });

  it("a send failure tells the user to load a model first", async () => {
    const { dispatchMessage, useFishStore, llm, AI_FISH_ID, NO_MODEL_MESSAGE } = await load();
    vi.mocked(llm.sendChatMessage).mockRejectedValueOnce(new Error("WebLLM engine is not initialized"));

    await dispatchMessage("hello");

    expect(useFishStore.getState().fish[AI_FISH_ID].message.message).toBe(NO_MODEL_MESSAGE);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/dispatcher.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (`src/state/dispatcher.ts`)

```ts
import { sendChatMessage } from "../llm/engine";
import { COMMANDS, EMOTES, fromMessage, fromReply, isCommand, isEmpty, thinking, type ChatMessage } from "./chatMessage";
import { AI_FISH_ID, USER_FISH_ID, useFishStore } from "./fishStore";
import { parseReasoning, peek } from "./reasoningParser";

export const ABOUT_URL = "https://github.com/dkackman/ChatFish";
export const EMPTY_REPLY_FALLBACK = "🫧 (I didn't have anything to say — try again?)";
export const NO_MODEL_MESSAGE = "Make sure to select and download a model first.";

export async function dispatchMessage(text: string): Promise<void> {
  const message = fromMessage(text);
  if (isEmpty(message)) {
    return;
  }
  if (isCommand(message)) {
    processCommand(message.modifier);
    return;
  }
  await sendToFish(message);
}

function processCommand(command: string): void {
  const store = useFishStore.getState();
  switch (command) {
    case "help":
      store.showToast({
        title: "Help",
        caption: "Available commands",
        messages: [
          ...Object.entries(COMMANDS).map(([name, description]) => `/${name} - ${description}`),
          ...Object.entries(EMOTES).map(([name, description]) => `/${name} - ${description}`),
        ],
      });
      break;
    case "about":
      window.open(ABOUT_URL, "_blank");
      break;
    case "llm":
      store.openSettings();
      break;
  }
}

async function sendToFish(message: ChatMessage): Promise<void> {
  const { setFishMessage } = useFishStore.getState();

  setFishMessage(USER_FISH_ID, message);
  // Show the animated "thinking" bubble immediately; it stays until the
  // first streamed token replaces it (or an error clears it).
  setFishMessage(AI_FISH_ID, thinking());

  try {
    await sendChatMessage(message.message, {
      // Partial reply streamed token-by-token. Reasoning models stream a
      // <think>...</think> chain-of-thought before the answer; while that is
      // still arriving we keep the thinking bubble and let its peek follow the
      // live reasoning, only switching once real answer text appears.
      onUpdate(partial) {
        const parsed = parseReasoning(partial);
        if (parsed.isReasoning) {
          setFishMessage(AI_FISH_ID, thinking(peek(parsed.reasoning)));
        } else if (parsed.answer.trim()) {
          setFishMessage(AI_FISH_ID, fromReply(parsed.answer));
        }
        // else: answer hasn't started yet (e.g. just past </think>) — leave the
        // thinking bubble in place rather than flashing it blank.
      },
      // Final reply. Show only the answer (reasoning was transient), with a
      // fallback so an empty turn doesn't silently vanish.
      onFinish(final) {
        const answer = parseReasoning(final).answer;
        setFishMessage(AI_FISH_ID, fromReply(answer.trim() ? answer : EMPTY_REPLY_FALLBACK));
      },
      onError(error) {
        setFishMessage(AI_FISH_ID, fromReply(error));
      },
    });
  } catch {
    setFishMessage(AI_FISH_ID, fromReply(NO_MODEL_MESSAGE));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/dispatcher.test.ts` — Expected: PASS (11 tests).
Run: `npm test` — Expected: full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/dispatcher.ts src/state/dispatcher.test.ts
git commit -m "Add message dispatcher with command routing and streaming updates"
```

---

### Task 11: Styles, MessageBubble, and FloatingToast

**Files:**
- Create: `src/styles/app.css`, `src/styles/utilities.css`, `src/styles/floating.css`, `src/styles/messageBubble.css`
- Create: `src/components/positioning.ts`, `src/components/MessageBubble.tsx`, `src/components/FloatingToast.tsx`
- Modify: `src/main.tsx` (import global styles)

**Interfaces:**
- Consumes: `ChatMessage`, `EMOTES`, `THINKING_MODIFIER`, `isThinking` from `../state/chatMessage`; `Toast` from `../state/fishStore`; `Direction`, `BubbleVerticalSide` from `../engine/geometry`.
- Produces:
  - `type FloatingPosition = "TopRight" | "TopLeft" | "BottomRight" | "BottomLeft"`; `positionClasses(position: FloatingPosition): string`
  - `<MessageBubble message isVisible fishDirection verticalSide />`
  - `<FloatingToast isVisible position toast showCloseButton? onClose? />`

- [ ] **Step 1: Copy the CSS that ports unchanged**

```bash
mkdir -p src/styles
cp ChatFish/ChatFish/wwwroot/css/floating-component.css src/styles/floating.css
cp ChatFish/ChatFish/Components/MessageBubble.razor.css src/styles/messageBubble.css
```

- [ ] **Step 2: Write the new global stylesheet** (`src/styles/app.css` — the used parts of the Blazor `app.css`, `MainLayout` inline styles, and `FishTank.razor.css`; Blazor-specific rules like `#blazor-error-ui` and the loading spinner are intentionally dropped)

```css
html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex-grow: 1;
  overflow: hidden;
}

#mainView {
  height: 100%;
  position: relative;
  padding: 1.1rem 1.5rem 0;
  background-image: url('/images/background.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

#mainView::before {
  content: "";
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.3);
  pointer-events: none;
}

#mainView > * {
  position: relative;
  height: 100%;
}

.fish-tank-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

#fishTank {
  flex-grow: 1;
  position: relative;
  overflow: hidden;
}
```

- [ ] **Step 3: Write the utility stylesheet** (`src/styles/utilities.css` — the handful of Bootstrap classes the markup uses, replacing the 200KB `bootstrap.min.css`)

```css
/* The small subset of Bootstrap utilities the app's markup relies on. */
.position-fixed { position: fixed; }
.top-0 { top: 0; }
.end-0 { right: 0; }
.bottom-0 { bottom: 0; }
.start-0 { left: 0; }
.p-3 { padding: 1rem; }
.me-auto { margin-right: auto; }
.w-100 { width: 100%; }
.mb-0 { margin-bottom: 0; }
.mb-2 { margin-bottom: 0.5rem; }
.ms-3 { margin-left: 1rem; }
.ps-3 { padding-left: 1rem; }

.list-unstyled {
  padding-left: 0;
  list-style: none;
}

.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.toast {
  max-width: 350px;
  font-size: 0.875rem;
}

.btn-close {
  box-sizing: content-box;
  width: 1em;
  height: 1em;
  padding: 0.25em;
  color: #000;
  background: transparent url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23000'%3e%3cpath d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/%3e%3c/svg%3e") center/1em auto no-repeat;
  border: 0;
  border-radius: 0.375rem;
  opacity: 0.5;
  cursor: pointer;
}

.btn-close:hover {
  opacity: 0.75;
}
```

- [ ] **Step 4: Import global styles in `src/main.tsx`**

Add at the top of the imports:

```ts
import "./styles/app.css";
import "./styles/utilities.css";
import "./styles/floating.css";
```

- [ ] **Step 5: Write `src/components/positioning.ts`** (port of `FloatingComponent.razor`)

```ts
export type FloatingPosition = "TopRight" | "TopLeft" | "BottomRight" | "BottomLeft";

export function positionClasses(position: FloatingPosition): string {
  const base = "position-fixed p-3";
  switch (position) {
    case "TopLeft":
      return `${base} top-0 start-0`;
    case "BottomRight":
      return `${base} bottom-0 end-0`;
    case "BottomLeft":
      return `${base} bottom-0 start-0`;
    default:
      return `${base} top-0 end-0`;
  }
}
```

- [ ] **Step 6: Write `src/components/MessageBubble.tsx`**

```tsx
import type { BubbleVerticalSide, Direction } from "../engine/geometry";
import { EMOTES, THINKING_MODIFIER, isThinking, type ChatMessage } from "../state/chatMessage";
import "../styles/messageBubble.css";

// Only known modifiers become CSS classes; anything else (e.g. a hostile
// modifier typed as "/<script> hi") is dropped. Replaces the Blazor
// HtmlSanitizer, which sanitized the modifier before class interpolation.
const MODIFIER_CLASS_ALLOWLIST = new Set([...Object.keys(EMOTES), THINKING_MODIFIER]);

interface MessageBubbleProps {
  message: ChatMessage;
  isVisible: boolean;
  fishDirection: Direction;
  verticalSide: BubbleVerticalSide;
}

export function MessageBubble({ message, isVisible, fishDirection, verticalSide }: MessageBubbleProps) {
  const modifierClass = MODIFIER_CLASS_ALLOWLIST.has(message.modifier) ? message.modifier : "";
  return (
    <div
      className={`message-bubble ${isVisible ? "visible" : "hidden"} ${modifierClass} ${fishDirection} ${verticalSide}`}
      role="status"
      aria-live="polite"
    >
      {isThinking(message) ? (
        <>
          <span className="thinking-dots" aria-label="thinking">
            <span></span>
            <span></span>
            <span></span>
          </span>
          {message.reasoning && (
            /* Decorative "watch the fish think" peek; aria-hidden so its rapid
               updates don't flood screen readers. React escapes the text. */
            <div className="thinking-reasoning" aria-hidden="true">
              {message.reasoning}
            </div>
          )}
        </>
      ) : (
        /* React escapes interpolated strings, so untrusted model/user text is
           rendered safely as literal text (including <think> tags or "a < b"). */
        message.message
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write `src/components/FloatingToast.tsx`**

```tsx
import type { Toast } from "../state/fishStore";
import { positionClasses, type FloatingPosition } from "./positioning";

interface FloatingToastProps {
  isVisible: boolean;
  position: FloatingPosition;
  toast: Toast | null;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export function FloatingToast({ isVisible, position, toast, showCloseButton = true, onClose }: FloatingToastProps) {
  if (!isVisible || !toast) {
    return null;
  }
  return (
    <div className={positionClasses(position)}>
      <div className="toast show floating-component" role="alert" aria-live="assertive" aria-atomic="true">
        <div className="toast-header floating-header">
          <strong className="me-auto">{toast.title}</strong>
          {showCloseButton && (
            <button type="button" className="btn-close floating-close" onClick={onClose} aria-label="Close"></button>
          )}
        </div>
        <div className="toast-body floating-body">
          <p>{toast.caption}</p>
          {toast.messages && toast.messages.length > 0 && (
            <ul className="list-unstyled mb-0 ps-3">
              {toast.messages.map((m) => (
                <li key={m} className="ms-3 mb-2">
                  {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify the build**

Run: `npm run build` — Expected: succeeds with no type errors.
(Components render on screen in Task 13; no component tests per the spec.)

- [ ] **Step 9: Commit**

```bash
git add src/styles src/components/positioning.ts src/components/MessageBubble.tsx src/components/FloatingToast.tsx src/main.tsx
git commit -m "Add styles, message bubble, and floating toast components"
```

---

### Task 12: Animation ticker, Fish, and FishTank

**Files:**
- Create: `src/engine/ticker.ts`, `src/components/Fish.tsx`, `src/components/FishTank.tsx`, `src/styles/fish.css`
- Test: `src/engine/ticker.test.ts`

**Interfaces:**
- Consumes: `FishAnimation`, geometry types, `useFishStore`, `FishData`, `USER_FISH_ID`, `MessageBubble`, `ChatInput` (placeholder import added in Task 13 — here render without it, see Step 6 note).
- Produces:
  - `TICK_MS = 50`; `createFixedStepper(stepMs?: number, maxSteps?: number): (now: number) => number`
  - `interface TankTicker { subscribe(handler: (tank: TankRect) => void): () => void; getTankRect(): TankRect | null; start(): void; stop(): void }`; `createTicker(getTankElement: () => HTMLElement | null): TankTicker`
  - `<Fish fish isClientFish ticker />`, `<FishTank />`

- [ ] **Step 1: Write the failing stepper tests** (`src/engine/ticker.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { TICK_MS, createFixedStepper } from "./ticker";

describe("createFixedStepper", () => {
  it("emits no step on the first call (baseline only)", () => {
    const step = createFixedStepper();
    expect(step(1000)).toBe(0);
  });

  it("emits one step per elapsed tick", () => {
    const step = createFixedStepper();
    step(0);
    expect(step(TICK_MS)).toBe(1);
    expect(step(TICK_MS * 3)).toBe(2);
  });

  it("accumulates partial ticks", () => {
    const step = createFixedStepper();
    step(0);
    expect(step(30)).toBe(0);
    expect(step(60)).toBe(1); // 60ms elapsed total
  });

  it("clamps catch-up steps after a long gap (background tab)", () => {
    const step = createFixedStepper(TICK_MS, 4);
    step(0);
    expect(step(10_000)).toBe(4);
    expect(step(10_000 + TICK_MS)).toBe(1); // accumulator was reset, not drained
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/ticker.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (`src/engine/ticker.ts`)

```ts
import type { TankRect } from "./geometry";

// The physics was tuned for the Blazor app's 50 ms timer (speeds are px/tick,
// direction changes are probability/tick), so the rAF loop steps the
// simulation at the same fixed interval rather than per frame.
export const TICK_MS = 50;

// Converts a stream of timestamps into a number of fixed-size steps, clamping
// catch-up after long gaps (e.g. a backgrounded tab) so fish don't teleport.
export function createFixedStepper(stepMs = TICK_MS, maxSteps = 4): (now: number) => number {
  let last: number | null = null;
  let acc = 0;
  return (now: number): number => {
    if (last === null) {
      last = now;
      return 0;
    }
    acc += now - last;
    last = now;
    let steps = Math.floor(acc / stepMs);
    if (steps > maxSteps) {
      steps = maxSteps;
      acc = 0;
    } else {
      acc -= steps * stepMs;
    }
    return steps;
  };
}

export interface TankTicker {
  subscribe(handler: (tank: TankRect) => void): () => void;
  getTankRect(): TankRect | null;
  start(): void;
  stop(): void;
}

export function createTicker(getTankElement: () => HTMLElement | null): TankTicker {
  const handlers = new Set<(tank: TankRect) => void>();
  let rafId = 0;
  let step = createFixedStepper();

  function frame(now: number) {
    rafId = requestAnimationFrame(frame);
    let steps = step(now);
    while (steps-- > 0) {
      const el = getTankElement();
      if (!el) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      for (const handler of handlers) {
        handler(rect);
      }
    }
  }

  return {
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    getTankRect() {
      const el = getTankElement();
      return el ? el.getBoundingClientRect() : null;
    },
    start() {
      if (!rafId) {
        step = createFixedStepper();
        rafId = requestAnimationFrame(frame);
      }
    },
    stop() {
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/ticker.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Copy the fish CSS**

```bash
cp ChatFish/ChatFish/Components/Fish.razor.css src/styles/fish.css
```

- [ ] **Step 6: Write `src/components/Fish.tsx`**

```tsx
import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { FishAnimation } from "../engine/fishAnimation";
import { direction as velocityDirection, type BubbleVerticalSide, type Direction } from "../engine/geometry";
import type { TankTicker } from "../engine/ticker";
import type { FishData } from "../state/fishStore";
import { MessageBubble } from "./MessageBubble";
import "../styles/fish.css";

// There are different animated PNGs used based on the fish's speed, because
// the PNG animation speed cannot be set dynamically. (Same thresholds as the
// Blazor app, including only right-moving fish ever using the faster frames.)
function frameDuration(dx: number): string {
  if (dx > 3.0) {
    return "66";
  }
  if (dx > 2.25) {
    return "75";
  }
  return "100";
}

interface FishProps {
  fish: FishData;
  isClientFish: boolean;
  ticker: TankTicker;
}

export function Fish({ fish, isClientFish, ticker }: FishProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<FishAnimation | null>(null);
  if (!animationRef.current) {
    animationRef.current = new FishAnimation();
  }
  const animation = animationRef.current;

  // React-owned render state, updated from the tick handler. setState bails
  // out on equal values, so per-tick updates only re-render on real changes.
  const [dir, setDir] = useState<Direction>(() => velocityDirection(animation.velocity));
  const [frame, setFrame] = useState("100");
  const [bubbleSide, setBubbleSide] = useState<BubbleVerticalSide>("above");

  // Place the new fish at a random point within the tank, before first paint.
  useLayoutEffect(() => {
    const tank = ticker.getTankRect();
    if (tank) {
      animation.initializePosition(tank);
      setDir(velocityDirection(animation.velocity));
      const el = containerRef.current;
      if (el) {
        el.style.left = `${animation.position.left}px`;
        el.style.top = `${animation.position.top}px`;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulation tick: run physics, write position straight to the DOM, and
  // sync the (rarely changing) direction/frame/bubble-side into React.
  useEffect(() => {
    return ticker.subscribe((tankRect) => {
      if (!animation.enabled) {
        return;
      }
      const el = containerRef.current;
      // Measure the fish once (after its image has loaded) and cache the size,
      // so subsequent ticks run with no layout reads.
      if (!animation.hasSize && el) {
        const rect = el.getBoundingClientRect();
        animation.setSize({ width: rect.width, height: rect.height });
      }
      animation.incrementPosition(tankRect);
      if (el) {
        el.style.left = `${animation.position.left}px`;
        el.style.top = `${animation.position.top}px`;
      }
      setDir(velocityDirection(animation.velocity));
      setFrame(frameDuration(animation.velocity.dx));
      setBubbleSide(animation.bubbleSide);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  // The bubble is measured once per message (its size changes with the text)
  // and fed to the physics so the fish turns before the bubble hits a wall.
  useLayoutEffect(() => {
    if (fish.isMessageVisible) {
      const bubble = containerRef.current?.querySelector(".message-bubble");
      if (bubble) {
        const rect = bubble.getBoundingClientRect();
        animation.setBubble({ width: rect.width, height: rect.height });
      }
    } else {
      animation.clearBubble();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fish.message, fish.isMessageVisible]);

  // Drag: pause the simulation, follow the mouse, then resume swimming from
  // the drop point in the opposite direction (port of makeDraggable).
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    animation.enabled = false;
    let lastX = e.clientX;
    let lastY = e.clientY;
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      el.style.left = `${el.offsetLeft + (ev.clientX - lastX)}px`;
      el.style.top = `${el.offsetTop + (ev.clientY - lastY)}px`;
      lastX = ev.clientX;
      lastY = ev.clientY;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      animation.moveFish({ left: el.offsetLeft, top: el.offsetTop });
      animation.enabled = true;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const spriteDirection = dir === "right" ? "Right" : "Left";
  return (
    <div ref={containerRef} className="fish-container" onMouseDown={onMouseDown}>
      <MessageBubble
        message={fish.message}
        isVisible={fish.isMessageVisible}
        fishDirection={dir}
        verticalSide={bubbleSide}
      />
      <div className={`fish-wrapper ${dir} ${fish.isMessageVisible ? "message-visible" : ""}`}>
        <img
          className="fish-img"
          src={`/fish/${fish.color}/${spriteDirection}-${frame}.png`}
          alt={`${fish.color} fish`}
          aria-label={`${fish.color} fish ${isClientFish ? "- your fish" : ""}`}
          style={{ transform: `scale(${fish.scale})` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `src/components/FishTank.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { createTicker, type TankTicker } from "../engine/ticker";
import { USER_FISH_ID, useFishStore } from "../state/fishStore";
import { Fish } from "./Fish";

export function FishTank() {
  const fish = useFishStore((s) => s.fish);
  const tankRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<TankTicker | null>(null);
  if (!tickerRef.current) {
    tickerRef.current = createTicker(() => tankRef.current);
  }
  const ticker = tickerRef.current;

  useEffect(() => {
    ticker.start();
    return () => ticker.stop();
  }, [ticker]);

  const fishList = Object.values(fish);
  return (
    <div id="fishTank" ref={tankRef} aria-label="Fish tank with swimming fish and an octopus">
      <div aria-live="polite" className="visually-hidden">
        There are currently {fishList.length} fish in the tank, and one octopus.
      </div>
      {fishList.map((f) => (
        <Fish key={f.id} fish={f} isClientFish={f.id === USER_FISH_ID} ticker={ticker} />
      ))}
    </div>
  );
}
```

(The `.fish-tank-container` wrapper with `<ChatInput />` is assembled in `App.tsx` in Task 13.)

- [ ] **Step 8: Wire a temporary App to see fish swim** — replace `src/App.tsx`:

```tsx
import { FishTank } from "./components/FishTank";

export default function App() {
  return (
    <div className="page">
      <main>
        <article id="mainView" className="content">
          <div className="fish-tank-container">
            <FishTank />
          </div>
        </article>
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Verify in the browser**

Run: `npm run build` — Expected: no type errors.
Run: `npm run dev`, open the printed URL. Expected: background image with two fish (orange and blue) swimming, bouncing off edges, occasionally turning; fish are draggable with the mouse and swim away in the opposite direction on release. StrictMode note: effects run twice in dev; subscribe cleanups above handle this — if a fish moves at double speed, a subscription leaked.

- [ ] **Step 10: Commit**

```bash
git add src/engine/ticker.ts src/engine/ticker.test.ts src/styles/fish.css src/components/Fish.tsx src/components/FishTank.tsx src/App.tsx
git commit -m "Add animation ticker, fish, and fish tank components"
```

---

### Task 13: ChatInput, LLMSettingsDialog, and App wiring

**Files:**
- Create: `src/components/ChatInput.tsx`, `src/components/LLMSettingsDialog.tsx`, `src/styles/chatInput.css`, `src/styles/llmSettings.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `dispatchMessage`, `useFishStore`, `useLlmStore`, `FloatingToast`, `positionClasses`, `FishTank`.
- Produces: the complete app — `<ChatInput />`, `<LLMSettingsDialog />`, final `App`.

- [ ] **Step 1: Copy the CSS that ports unchanged**

```bash
cp ChatFish/ChatFish/Components/ChatInput.razor.css src/styles/chatInput.css
cp ChatFish/ChatFish/Components/LLMSettingsDialog.razor.css src/styles/llmSettings.css
```

Then in `src/styles/llmSettings.css`, scope the first rule: change the `.floating-component { width: 350px; ... }` selector to `.llm-settings.floating-component` (it was Blazor-scoped CSS; unscoped it would set every floating component to 350px).

- [ ] **Step 2: Write `src/components/ChatInput.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { dispatchMessage } from "../state/dispatcher";
import "../styles/chatInput.css";

export function ChatInput() {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      return;
    }
    // Clear the input up front so it empties as the user's fish bubble appears,
    // not after the model finishes responding (the dispatch awaits generation).
    const message = text;
    setText("");
    void dispatchMessage(message);
  }

  return (
    <form onSubmit={onSubmit} className="chat-input-container" aria-label="Chat message input">
      <input
        id="chat-message"
        ref={inputRef}
        type="text"
        className="chat-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={45}
        placeholder="Type a short message... (/help for more)"
        aria-label="Chat message input"
      />
      <button type="submit" className="chat-submit" disabled={!text.trim()} aria-label="Send message">
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write `src/components/LLMSettingsDialog.tsx`**

```tsx
import { useEffect } from "react";
import { useFishStore } from "../state/fishStore";
import { useLlmStore } from "../state/llmStore";
import { positionClasses } from "./positioning";
import "../styles/llmSettings.css";

export function LLMSettingsDialog() {
  const isVisible = useFishStore((s) => s.isSettingsVisible);
  const closeSettings = useFishStore((s) => s.closeSettings);
  const {
    availableModels,
    downloadedModels,
    selectedModel,
    loadedModel,
    progressText,
    progressValue,
    isProgressVisible,
    initialize,
    selectModel,
    loadEngine,
  } = useLlmStore();

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible) {
    return null;
  }

  const isDownloaded = downloadedModels.includes(selectedModel);
  return (
    <div className={positionClasses("TopLeft")} role="dialog" aria-labelledby="llm-settings-title">
      <div className="floating-component llm-settings">
        <div className="floating-header">
          <strong id="llm-settings-title" className="me-auto">
            Configure Chat LLM Settings
          </strong>
          <button type="button" className="btn-close floating-close" onClick={closeSettings} aria-label="Close"></button>
        </div>
        <div className="floating-body">
          <div className="download-container">
            <label htmlFor="model-selection" className="visually-hidden">
              Select LLM Model
            </label>
            <select
              id="model-selection"
              value={selectedModel}
              onChange={(e) => selectModel(e.target.value)}
              aria-label="Select LLM Model"
            >
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                  {downloadedModels.includes(model) ? " (downloaded)" : ""}
                </option>
              ))}
            </select>
            <button
              id="download"
              type="button"
              onClick={() => void loadEngine()}
              aria-label={isDownloaded ? "Load selected model" : "Download selected model"}
            >
              {isDownloaded ? "Load" : "Download"}
            </button>
          </div>
          <p className="model-status" aria-live="polite">
            {loadedModel ? (
              <span>
                Loaded: <strong>{loadedModel}</strong>
              </span>
            ) : (
              <span>No model loaded</span>
            )}
          </p>
          {isProgressVisible && (
            <div>
              <label htmlFor="download-progress" className="visually-hidden">
                Download progress
              </label>
              <progress id="download-progress" value={progressValue * 100} max={100} className="w-100 mb-2" />
              <p id="download-status" aria-live="polite">
                {progressText}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the final `src/App.tsx`**

```tsx
import { useEffect } from "react";
import { ChatInput } from "./components/ChatInput";
import { FishTank } from "./components/FishTank";
import { FloatingToast } from "./components/FloatingToast";
import { LLMSettingsDialog } from "./components/LLMSettingsDialog";
import { useFishStore } from "./state/fishStore";

const OFFLINE_TOAST = { title: "You are offline", caption: "Functionality will be limited." };

export default function App() {
  const isOffline = useFishStore((s) => s.isOffline);
  const toast = useFishStore((s) => s.toast);
  const closeToast = useFishStore((s) => s.closeToast);
  const setOffline = useFishStore((s) => s.setOffline);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [setOffline]);

  return (
    <div className="page">
      <main>
        <article id="mainView" className="content">
          <div className="fish-tank-container">
            <FishTank />
            <ChatInput />
          </div>
        </article>
      </main>
      <LLMSettingsDialog />
      <FloatingToast isVisible={isOffline} position="BottomRight" showCloseButton={false} toast={OFFLINE_TOAST} />
      <FloatingToast isVisible={toast !== null} position="TopRight" toast={toast} onClose={closeToast} />
    </div>
  );
}
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run build` && `npm test` — Expected: both green.
Run: `npm run dev` and check:
1. Settings dialog visible top-left on load; model dropdown populated from web-llm's prebuilt list; close button hides it.
2. `/llm` in the chat input reopens the dialog; `/help` shows a toast top-right listing all five commands/emotes; `/about` opens the GitHub repo in a new tab.
3. Sending "hello" without a model shows "Make sure to select and download a model first." in the orange fish's bubble (after the thinking dots).
4. `/shout hi` renders the user bubble bold/red/uppercase; `/whisper hi` small/gray/lowercase.
5. Bubbles hide after ~25s; a bubble on a fish near the top edge renders below the fish.
6. DevTools → Network → Offline: the offline toast appears bottom-right; Online: it disappears.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChatInput.tsx src/components/LLMSettingsDialog.tsx src/styles/chatInput.css src/styles/llmSettings.css src/App.tsx
git commit -m "Add chat input, LLM settings dialog, and complete app wiring"
```

---

### Task 14: PWA support

**Files:**
- Modify: `vite.config.ts`, `src/main.tsx`, `src/vite-env.d.ts`

**Interfaces:**
- Produces: installable PWA; app shell + assets precached by a generated service worker; model weights untouched (web-llm manages its own Cache Storage).

- [ ] **Step 1: Configure vite-plugin-pwa** — replace `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ChatFish",
        short_name: "ChatFish",
        id: "./",
        start_url: "./",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#03173d",
        prefer_related_applications: false,
        icons: [
          { src: "icon-512.png", type: "image/png", sizes: "512x512" },
          { src: "icon-192.png", type: "image/png", sizes: "192x192" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,jpg,webmanifest}"],
        // the web-llm chunk is large; raise the precache single-file limit
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 2: Register the service worker** — in `src/main.tsx` add after the style imports:

```ts
import { registerSW } from "virtual:pwa-register";

registerSW();
```

And update `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 3: Verify**

Run: `npm run build` — Expected: `dist/sw.js` and `dist/manifest.webmanifest` exist; build output lists precached entries.
Run: `npm run preview`, open in Chrome → DevTools → Application: manifest parses with icons; service worker activates; page is installable.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts src/main.tsx src/vite-env.d.ts
git commit -m "Add PWA manifest and service worker via vite-plugin-pwa"
```

---

### Task 15: Retire dotnet — cleanup, README, dig.toml, VS Code config

**Files:**
- Delete: `ChatFish/`, `ChatFish.Tests/`, `ChatFish.sln`, `publish/`
- Modify: `README.md`, `dig.toml`, `.vscode/tasks.json`, `.vscode/launch.json`, `.vscode/settings.json`, `.gitignore`

**Interfaces:**
- Consumes: the fully working app from Tasks 1–14.

- [ ] **Step 1: Confirm nothing still references the old tree**

Run: `grep -rn "ChatFish/wwwroot\|ChatFish.sln\|dotnet" src vite.config.ts package.json index.html` — Expected: no matches. If any file still copies from `ChatFish/`, fix it first.

- [ ] **Step 2: Delete the dotnet projects**

```bash
git rm -r ChatFish ChatFish.Tests ChatFish.sln
git rm -r --cached publish 2>/dev/null; rm -rf publish
```

(`publish/` is git-ignored build output but was partially committed; remove both ways. Keep `tools/crop-fish.py` — it's an asset script, not dotnet.)

- [ ] **Step 3: Update `dig.toml`** — replace the `output-dir` line and the build-command block:

```toml
# The folder `deploy` publishes (your build output).
output-dir = "dist"
```

and replace the commented build-command section at the bottom with:

```toml
# Run the build before each deploy (digstore 0.7.0 runs this from the repo root):
build-command = "npm ci && npm run build"
```

Leave `store-id` and `remote` untouched.

- [ ] **Step 4: Rewrite `README.md`**

```markdown
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
- [Node.js](https://nodejs.org/) 20+ to build and run.

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
```

- [ ] **Step 5: Replace `.vscode/tasks.json`**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "npm",
      "script": "build",
      "group": { "kind": "build", "isDefault": true },
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "dev",
      "type": "npm",
      "script": "dev",
      "isBackground": true,
      "problemMatcher": []
    },
    {
      "label": "test",
      "type": "npm",
      "script": "test",
      "group": { "kind": "test", "isDefault": true },
      "problemMatcher": []
    }
  ]
}
```

Also open `.vscode/launch.json` and `.vscode/settings.json`; delete dotnet/Blazor-specific entries (e.g. a `blazorwasm` or `coreclr` launch config). If a file becomes empty apart from `{}`, delete it.

- [ ] **Step 6: Trim `.gitignore`**

The Visual Studio boilerplate can stay (harmless), but ensure these remain/exist: `node_modules/`, `dist/`, `.dig/`. Optionally replace the whole file with:

```
node_modules/
dist/
.dig/
.DS_Store
```

- [ ] **Step 7: Verify and commit**

Run: `npm run build && npm test` — Expected: both green.

```bash
git add -A
git commit -m "Remove Blazor projects; update README, dig.toml, and editor config for the React app"
```

---

### Task 16: Parity verification

**Files:** none (verification only).

- [ ] **Step 1: Automated checks**

Run: `npm test` — Expected: all suites pass.
Run: `npm run build` — Expected: clean build, `dist/` contains `index.html`, `sw.js`, `manifest.webmanifest`, `fish/`, `images/`.

- [ ] **Step 2: Walk the feature inventory in the browser** (`npm run dev`, WebGPU-capable browser)

1. Two fish (orange AI scale 1.0, blue user 0.9) swim, bounce, randomly turn; both draggable.
2. Settings dialog visible on load; download the default `Llama-3.2-1B-Instruct-q4f16_1-MLC`; progress bar advances; status shows "Loaded: …"; dropdown shows "(downloaded)"; reload the page — selection persisted, button now reads "Load".
3. Chat: user bubble + thinking dots appear immediately; streamed reply replaces dots; bubbles auto-hide after ~25s; long replies wrap inside the bubble; a fish at the top edge shows its bubble below.
4. Reasoning model (e.g. `DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC`): live reasoning peek scrolls under the dots; final bubble shows only the answer.
5. All five slash commands behave as in Task 13 Step 5.
6. Watchdog sanity (optional): send a message, then in DevTools kill the worker thread — a stall message should appear within 20–30s.
7. Offline toggle shows/hides the offline toast; `npm run preview` build is installable as a PWA.

- [ ] **Step 3: Report**

Summarize any deviations found; fix or file them before deploying with `digstore`.

---

## Self-Review Notes

- Spec coverage: architecture (Tasks 1–3, 12), data flow (Tasks 8, 10), errors (Tasks 7–10), model management (Tasks 8–9, 13), PWA (14), build/deploy + cleanup (15), parity verification (16). Dead code intentionally not ported per Global Constraints.
- Type consistency spot checks: `Size {width,height}` everywhere (the C# `Size(height, width)` argument-order trap is eliminated by named fields); `GenerationCallbacks` shared by Tasks 7/8/10; `TankRect` satisfied by `DOMRect`; `FishColor` capitalized to match sprite directory names.
