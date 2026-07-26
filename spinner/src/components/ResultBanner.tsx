import { motion } from "framer-motion";
import { fullName } from "../data/roster";
import type { Student } from "../types";

interface Props {
  student: Student;
  onCorrect: () => void;
  onWrong: () => void;
}

export function ResultBanner({ student, onCorrect, onWrong }: Props) {
  return (
    <div className="result-banner">
      <motion.span
        className="winner-name"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {fullName(student)}
      </motion.span>
      <motion.div
        className="result-actions"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <button type="button" className="success" onClick={onCorrect}>
          Correct
        </button>
        <button type="button" className="danger" onClick={onWrong}>
          Wrong
        </button>
      </motion.div>
    </div>
  );
}
