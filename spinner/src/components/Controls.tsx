import type { Phase } from "../types";

interface Props {
  phase: Phase;
  poolSize: number;
  raisedCount: number;
  onRequestQuestion: () => void;
  onLockPool: () => void;
  onSpin: () => void;
  onReset: () => void;
}

export function Controls({
  phase,
  poolSize,
  raisedCount,
  onRequestQuestion,
  onLockPool,
  onSpin,
  onReset,
}: Props) {
  return (
    <div className="controls">
      {phase === "idle" && (
        <button type="button" className="primary" onClick={onRequestQuestion}>
          Request a question
        </button>
      )}

      {phase === "collecting" && (
        <button
          type="button"
          className="primary"
          onClick={onLockPool}
          disabled={raisedCount === 0}
        >
          Lock hands ({raisedCount})
        </button>
      )}

      {phase === "locked" && (
        <button type="button" className="event" onClick={onSpin} disabled={poolSize === 0}>
          Spin ({poolSize} in the pool)
        </button>
      )}

      {(phase === "exhausted" || phase === "collecting" || phase === "locked") && (
        <button type="button" className="ghost" onClick={onReset}>
          Start over
        </button>
      )}
    </div>
  );
}
