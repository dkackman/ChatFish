import { useEffect, useRef } from "react";
import { createTicker, type TankTicker } from "../engine/ticker";
import { USER_FISH_ID, useFishStore } from "../state/fishStore";
import { Fish } from "./Fish";

const TANK_ID = "fishTank";

export function FishTank() {
  const fish = useFishStore((s) => s.fish);
  const tickerRef = useRef<TankTicker | null>(null);
  if (!tickerRef.current) {
    // Looked up by id rather than a React ref: a Fish child's own mount-time
    // layout effect runs before this div's ref is attached (children complete
    // before their parent in React's commit order), so a ref would still be
    // null the first time a fish asks for the tank rect. The DOM node itself
    // is already inserted by then, so an id lookup resolves correctly.
    tickerRef.current = createTicker(() => document.getElementById(TANK_ID));
  }
  const ticker = tickerRef.current;

  useEffect(() => {
    ticker.start();
    return () => ticker.stop();
  }, [ticker]);

  const fishList = Object.values(fish);
  return (
    <div id={TANK_ID} aria-label="Fish tank with swimming fish">
      <div aria-live="polite" className="visually-hidden">
        There are currently {fishList.length} fish in the tank.
      </div>
      {fishList.map((f) => (
        <Fish key={f.id} fish={f} isClientFish={f.id === USER_FISH_ID} ticker={ticker} />
      ))}
    </div>
  );
}
