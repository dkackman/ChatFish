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

  // Spawns within the middle half of each axis so a new fish appears away
  // from the tank walls rather than potentially right at an edge.
  initializePosition(tank: TankRect): void {
    const marginX = tank.width * 0.25;
    const marginY = tank.height * 0.25;
    const left = marginX + (tank.width - marginX * 2) * Math.random();
    const top = marginY + (tank.height - marginY * 2) * Math.random();
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
