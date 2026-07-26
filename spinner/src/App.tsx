import { useState } from "react";
import { Header } from "./components/Header";
import { StudentGrid } from "./components/StudentGrid";
import { Controls } from "./components/Controls";
import { SpinCarousel } from "./components/SpinCarousel";
import { ResultBanner } from "./components/ResultBanner";
import { useLocalSpinnerState } from "./state/useLocalSpinnerState";
import { pickRandom } from "./lib/random";
import type { Student } from "./types";

export default function App() {
  const [view, actions] = useLocalSpinnerState();
  const [spinWinner, setSpinWinner] = useState<Student | null>(null);

  const raisedCount = view.students.filter(
    (s) => view.handState[s.id] === "raised"
  ).length;

  const poolStudents = view.pool
    .map((id) => view.students.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s));

  function handleSpin() {
    if (poolStudents.length === 0) return;
    setSpinWinner(pickRandom(poolStudents));
    actions.spin();
  }

  function handleReset() {
    setSpinWinner(null);
    actions.reset();
  }

  const selectedStudent = view.students.find((s) => s.id === view.selectedId) ?? null;

  return (
    <main>
      <Header tally={view.tally} />

      <StudentGrid
        students={view.students}
        handState={view.handState}
        selectedId={view.selectedId}
        phase={view.phase}
        onToggleHand={actions.toggleHand}
      />

      {view.phase === "spinning" && spinWinner && (
        <SpinCarousel
          pool={poolStudents}
          winner={spinWinner}
          onSettle={() => actions.landOn(spinWinner.id)}
        />
      )}

      {view.phase === "result" && selectedStudent && (
        <ResultBanner
          student={selectedStudent}
          onCorrect={actions.markCorrect}
          onWrong={actions.markWrong}
        />
      )}

      {view.phase === "exhausted" && (
        <div className="empty-state card">
          Everyone in the pool has had a turn. Start a new question when ready.
        </div>
      )}

      <Controls
        phase={view.phase}
        poolSize={view.pool.length}
        raisedCount={raisedCount}
        onRequestQuestion={actions.requestQuestion}
        onLockPool={actions.lockPool}
        onSpin={handleSpin}
        onReset={handleReset}
      />
    </main>
  );
}
