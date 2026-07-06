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
