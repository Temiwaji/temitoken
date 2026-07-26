import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { fullName } from "../data/roster";
import type { Student } from "../types";
import { playChime, playTick } from "../lib/sound";

const CARD_STEP = 164; // must match .spin-card width (150) + .spin-track gap (14) in globals.css
const REPEATS = 10;
const TARGET_REPEAT = REPEATS - 2;

interface Props {
  pool: Student[];
  winner: Student;
  onSettle: () => void;
}

export function SpinCarousel({ pool, winner, onSettle }: Props) {
  const settledRef = useRef(false);

  const { strip, finalX } = useMemo(() => {
    const strip: Student[] = [];
    for (let r = 0; r < REPEATS; r++) strip.push(...pool);
    const winnerIndexInPool = pool.findIndex((s) => s.id === winner.id);
    const targetIndex = TARGET_REPEAT * pool.length + winnerIndexInPool;
    return { strip, finalX: -(targetIndex * CARD_STEP) };
  }, [pool, winner]);

  useEffect(() => {
    let cancelled = false;
    let delay = 90;
    const maxDelay = 420;

    function tick() {
      if (cancelled) return;
      playTick(0.9 + delay / maxDelay);
      delay = Math.min(delay * 1.18, maxDelay);
      if (delay < maxDelay) {
        setTimeout(tick, delay);
      }
    }
    const starter = setTimeout(tick, delay);

    return () => {
      cancelled = true;
      clearTimeout(starter);
    };
  }, []);

  return (
    <div className="spin-stage">
      <div className="spin-pointer" />
      <motion.div
        className="spin-track"
        initial={{ x: 0 }}
        animate={{ x: [0, finalX - 40, finalX] }}
        transition={{ duration: 3.6, times: [0, 0.88, 1], ease: ["circOut", "backOut"] }}
        onAnimationComplete={() => {
          if (settledRef.current) return;
          settledRef.current = true;
          playChime();
          onSettle();
        }}
      >
        {strip.map((s, i) => (
          <div key={`${s.id}-${i}`} className="spin-card">
            {fullName(s)}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
