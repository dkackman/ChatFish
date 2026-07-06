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
