import { TEACHER, STUDENTS } from "../data/roster";
import type { StudentTally } from "../types";

interface Props {
  tally: Record<number, StudentTally>;
}

export function Header({ tally }: Props) {
  return (
    <header className="hero">
      <h1>Class Spinner</h1>
      <p className="tagline">
        {TEACHER.firstName} {TEACHER.lastName}'s classroom &middot; who answers next?
      </p>
      <div className="streak-strip" aria-label="Session correct/wrong tally">
        {STUDENTS.map((s) => {
          const t = tally[s.id] ?? { correct: 0, wrong: 0 };
          const color =
            t.correct > t.wrong
              ? "var(--success)"
              : t.wrong > t.correct
                ? "var(--danger)"
                : "var(--border)";
          return (
            <span
              key={s.id}
              title={`${s.firstName} ${s.lastName}: ${t.correct} correct, ${t.wrong} wrong`}
              className="streak-dot"
              style={{ background: color }}
            />
          );
        })}
      </div>
    </header>
  );
}
