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
