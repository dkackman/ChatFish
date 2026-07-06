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
