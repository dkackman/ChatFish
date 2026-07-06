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
