import { motion } from "framer-motion";
import { fullName, initials } from "../data/roster";
import type { HandState, Phase, Student } from "../types";

interface Props {
  students: Student[];
  handState: Record<number, HandState>;
  selectedId: number | null;
  phase: Phase;
  onToggleHand: (id: number) => void;
}

function statusClass(state: HandState, isSelected: boolean, phase: Phase): string {
  if (isSelected && (phase === "result" || phase === "spinning")) return "selected";
  if (state === "correct") return "correct";
  if (state === "wrong" || state === "excluded") return "excluded";
  if (state === "raised") return "raised";
  return "";
}

export function StudentGrid({ students, handState, selectedId, phase, onToggleHand }: Props) {
  const canToggle = phase === "collecting";

  return (
    <div className="student-grid">
      {students.map((s) => {
        const state = handState[s.id];
        const isSelected = selectedId === s.id;
        return (
          <motion.div
            key={s.id}
            layout
            className={`student-card ${statusClass(state, isSelected, phase)}`}
            animate={isSelected && phase === "result" ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            <span className="avatar">{initials(s)}</span>
            <span className="name">{fullName(s)}</span>
            {canToggle && (
              <button
                type="button"
                className="hand-toggle"
                onClick={() => onToggleHand(s.id)}
              >
                {state === "raised" ? "Hand up" : "Raise hand"}
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
