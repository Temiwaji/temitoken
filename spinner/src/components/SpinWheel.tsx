import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { fullName } from "../data/roster";
import type { Student } from "../types";
import { playChime, playTick } from "../lib/sound";

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 138;
const FILLS = ["#1b2038", "#242b4d"];
const MIN_SPINS = 5;

function polarToCartesian(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function sectorPath(startAngle: number, endAngle: number) {
  const start = polarToCartesian(startAngle, RADIUS);
  const end = polarToCartesian(endAngle, RADIUS);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

interface Props {
  pool: Student[];
  winner: Student;
  onSettle: () => void;
}

export function SpinWheel({ pool, winner, onSettle }: Props) {
  const settledRef = useRef(false);
  const n = pool.length;
  const sliceAngle = 360 / n;
  const fontSize = n > 10 ? 9 : n > 6 ? 11 : 14;

  const finalRotation = useMemo(() => {
    const winnerIndex = pool.findIndex((s) => s.id === winner.id);
    const sliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    // Rotate the wheel so the winning slice's center lands under the pointer at
    // the top (angle 0), plus a few full spins for the visual.
    const landingOffset = (360 - sliceCenter) % 360;
    return MIN_SPINS * 360 + landingOffset;
  }, [pool, winner, sliceAngle]);

  useEffect(() => {
    settledRef.current = false;
    let cancelled = false;
    let delay = 90;
    const maxDelay = 420;

    function tick() {
      if (cancelled) return;
      playTick(0.9 + delay / maxDelay);
      delay = Math.min(delay * 1.18, maxDelay);
      if (delay < maxDelay) setTimeout(tick, delay);
    }
    const starter = setTimeout(tick, delay);

    return () => {
      cancelled = true;
      clearTimeout(starter);
    };
  }, [winner]);

  return (
    <div className="wheel-stage">
      <div className="wheel-pointer" />
      <motion.svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="wheel-svg"
        initial={{ rotate: 0 }}
        animate={{ rotate: [0, finalRotation - 12, finalRotation] }}
        transition={{ duration: 3.6, times: [0, 0.88, 1], ease: ["circOut", "backOut"] }}
        onAnimationComplete={() => {
          if (settledRef.current) return;
          settledRef.current = true;
          playChime();
          onSettle();
        }}
      >
        <circle cx={CENTER} cy={CENTER} r={RADIUS + 6} fill="none" stroke="var(--border)" strokeWidth="2" />
        {pool.map((s, i) => {
          const start = i * sliceAngle;
          const end = start + sliceAngle;
          const mid = start + sliceAngle / 2;
          const labelPos = polarToCartesian(mid, RADIUS * 0.62);
          return (
            <g key={s.id}>
              <path d={sectorPath(start, end)} fill={FILLS[i % FILLS.length]} stroke="var(--border)" strokeWidth="1.5" />
              <text
                x={labelPos.x}
                y={labelPos.y}
                fill="var(--text)"
                fontSize={fontSize}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
              >
                {fullName(s)}
              </text>
            </g>
          );
        })}
        <circle cx={CENTER} cy={CENTER} r={22} fill="var(--accent)" stroke="var(--bg)" strokeWidth="4" />
      </motion.svg>
    </div>
  );
}
