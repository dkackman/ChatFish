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
