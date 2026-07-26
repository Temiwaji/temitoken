export interface Student {
  id: number;
  firstName: string;
  lastName: string;
}

export type HandState = "down" | "raised" | "excluded" | "correct" | "wrong";

export type Phase =
  | "idle" // no question requested yet
  | "collecting" // hands can be raised
  | "locked" // pool frozen, ready to spin
  | "spinning" // carousel animating
  | "result" // a student is selected, awaiting correct/wrong
  | "exhausted"; // everyone in the pool has been marked wrong

export interface StudentTally {
  correct: number;
  wrong: number;
}

export interface SpinnerViewState {
  phase: Phase;
  students: Student[];
  handState: Record<number, HandState>;
  pool: number[]; // ids currently eligible to be spun, in locked order
  selectedId: number | null;
  tally: Record<number, StudentTally>;
  roundsCompleted: number;
}

export interface SpinnerActions {
  requestQuestion: () => void;
  toggleHand: (id: number) => void;
  lockPool: () => void;
  spin: () => void;
  landOn: (id: number) => void; // called by the carousel once its animation settles
  markCorrect: () => void;
  markWrong: () => void;
  reset: () => void;
}
