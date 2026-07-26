import { useCallback, useMemo, useReducer } from "react";
import { STUDENTS } from "../data/roster";
import type {
  HandState,
  Phase,
  SpinnerActions,
  SpinnerViewState,
  StudentTally,
} from "../types";

type Action =
  | { type: "REQUEST_QUESTION" }
  | { type: "TOGGLE_HAND"; id: number }
  | { type: "LOCK_POOL" }
  | { type: "SPIN" }
  | { type: "LAND_ON"; id: number }
  | { type: "MARK_CORRECT" }
  | { type: "MARK_WRONG" }
  | { type: "RESET" };

interface State {
  phase: Phase;
  handState: Record<number, HandState>;
  pool: number[];
  selectedId: number | null;
  tally: Record<number, StudentTally>;
  roundsCompleted: number;
}

function emptyTally(): Record<number, StudentTally> {
  return Object.fromEntries(STUDENTS.map((s) => [s.id, { correct: 0, wrong: 0 }]));
}

function initialState(): State {
  return {
    phase: "idle",
    handState: Object.fromEntries(STUDENTS.map((s) => [s.id, "down" as HandState])),
    pool: [],
    selectedId: null,
    tally: emptyTally(),
    roundsCompleted: 0,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REQUEST_QUESTION": {
      if (state.phase !== "idle") return state;
      return {
        ...state,
        phase: "collecting",
        handState: Object.fromEntries(STUDENTS.map((s) => [s.id, "down" as HandState])),
        pool: [],
        selectedId: null,
      };
    }

    case "TOGGLE_HAND": {
      if (state.phase !== "collecting") return state;
      const current = state.handState[action.id];
      const next: HandState = current === "raised" ? "down" : "raised";
      return {
        ...state,
        handState: { ...state.handState, [action.id]: next },
      };
    }

    case "LOCK_POOL": {
      if (state.phase !== "collecting") return state;
      const pool = STUDENTS.filter((s) => state.handState[s.id] === "raised").map(
        (s) => s.id
      );
      if (pool.length === 0) return state;
      return { ...state, phase: "locked", pool };
    }

    case "SPIN": {
      if (state.phase !== "locked" || state.pool.length === 0) return state;
      return { ...state, phase: "spinning", selectedId: null };
    }

    case "LAND_ON": {
      if (state.phase !== "spinning") return state;
      return { ...state, phase: "result", selectedId: action.id };
    }

    case "MARK_CORRECT": {
      if (state.phase !== "result" || state.selectedId === null) return state;
      const id = state.selectedId;
      return {
        ...state,
        phase: "idle",
        handState: { ...state.handState, [id]: "correct" },
        pool: [],
        selectedId: null,
        tally: {
          ...state.tally,
          [id]: { ...state.tally[id], correct: state.tally[id].correct + 1 },
        },
        roundsCompleted: state.roundsCompleted + 1,
      };
    }

    case "MARK_WRONG": {
      if (state.phase !== "result" || state.selectedId === null) return state;
      const id = state.selectedId;
      const remainingPool = state.pool.filter((studentId) => studentId !== id);
      const tally = {
        ...state.tally,
        [id]: { ...state.tally[id], wrong: state.tally[id].wrong + 1 },
      };
      const handState: Record<number, HandState> = {
        ...state.handState,
        [id]: "excluded",
      };

      if (remainingPool.length === 0) {
        return {
          ...state,
          phase: "exhausted",
          pool: remainingPool,
          selectedId: null,
          handState,
          tally,
        };
      }

      return {
        ...state,
        phase: "locked",
        pool: remainingPool,
        selectedId: null,
        handState,
        tally,
      };
    }

    case "RESET": {
      return {
        ...state,
        phase: "idle",
        handState: Object.fromEntries(STUDENTS.map((s) => [s.id, "down" as HandState])),
        pool: [],
        selectedId: null,
      };
    }

    default:
      return state;
  }
}

export function useLocalSpinnerState(): [SpinnerViewState, SpinnerActions] {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const requestQuestion = useCallback(() => dispatch({ type: "REQUEST_QUESTION" }), []);
  const toggleHand = useCallback((id: number) => dispatch({ type: "TOGGLE_HAND", id }), []);
  const lockPool = useCallback(() => dispatch({ type: "LOCK_POOL" }), []);
  const spin = useCallback(() => dispatch({ type: "SPIN" }), []);
  const landOn = useCallback((id: number) => dispatch({ type: "LAND_ON", id }), []);
  const markCorrect = useCallback(() => dispatch({ type: "MARK_CORRECT" }), []);
  const markWrong = useCallback(() => dispatch({ type: "MARK_WRONG" }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  const actions = useMemo<SpinnerActions>(
    () => ({ requestQuestion, toggleHand, lockPool, spin, landOn, markCorrect, markWrong, reset }),
    [requestQuestion, toggleHand, lockPool, spin, landOn, markCorrect, markWrong, reset]
  );

  const view = useMemo<SpinnerViewState>(
    () => ({
      phase: state.phase,
      students: STUDENTS,
      handState: state.handState,
      pool: state.pool,
      selectedId: state.selectedId,
      tally: state.tally,
      roundsCompleted: state.roundsCompleted,
    }),
    [state]
  );

  return [view, actions];
}
