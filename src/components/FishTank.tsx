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
