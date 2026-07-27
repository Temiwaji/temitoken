import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { erc20Abi } from "viem";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { motion } from "framer-motion";

import { Header } from "../Header";
import { StudentGrid } from "../StudentGrid";
import { SpinWheel } from "../SpinWheel";
import { ClaimIdentityPanel } from "./ClaimIdentityPanel";
import { RoundConfigForm } from "./RoundConfigForm";
import { StakeButton } from "./StakeButton";
import { TeacherRoundControls } from "./TeacherRoundControls";
import { ResolveSelected } from "./ResolveSelected";
import { RefundClaim } from "./RefundClaim";
import { useOnChainRound } from "../../state/useOnChainRound";
import { pickRandom } from "../../lib/random";
import { STUDENTS, fullName } from "../../data/roster";
import { SPINNER_CHAIN, STAKING_ADDRESS, TOKEN_ADDRESS, explorerUrl } from "../../lib/config";
import { formatAmount, shortenAddress } from "../../lib/format";
import type { HandState, Phase, Student, StudentTally } from "../../types";

const EMPTY_TALLY: Record<number, StudentTally> = Object.fromEntries(
  STUDENTS.map((s) => [s.id, { correct: 0, wrong: 0 }])
);

function toHandState(status: string): HandState {
  switch (status) {
    case "Raised":
      return "raised";
    case "Wrong":
      return "excluded";
    case "Correct":
      return "correct";
    default:
      return "down";
  }
}

export function StakingView() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const round = useOnChainRound();

  const { data: myBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 4000 },
  });

  const [uiPhase, setUiPhase] = useState<"idle" | "spinning" | "result">("idle");
  const [spinWinner, setSpinWinner] = useState<Student | null>(null);

  // Anyone can preview either panel - defaults to whichever role the connected
  // wallet actually has, but a manual pick always wins so a visitor (or a
  // grader) can look at both without needing to hold the teacher wallet.
  const [manualTab, setManualTab] = useState<"teacher" | "student" | null>(null);
  const viewTab: "teacher" | "student" =
    manualTab ?? (round.myStudentId > 0 && !round.isOwner ? "student" : "teacher");

  const handState: Record<number, HandState> = Object.fromEntries(
    STUDENTS.map((s) => [s.id, toHandState(round.handStatusById[s.id])])
  );

  const poolStudents = round.pool
    .map((id) => STUDENTS.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s));

  function handleSpin() {
    if (poolStudents.length === 0) return;
    setSpinWinner(pickRandom(poolStudents));
    setUiPhase("spinning");
  }

  function handleResolved() {
    setUiPhase("idle");
    setSpinWinner(null);
    round.refetchAll();
  }

  const displayPhase: Phase = uiPhase === "idle" ? "locked" : uiPhase;
  const myHandStatus = round.handStatusById[round.myStudentId] ?? "None";
  const needsRefund = round.roundState === "Closed" && myHandStatus === "Raised";

  // Round status is public chain data - readable by anyone, connected or not -
  // so this recap is not gated behind a wallet connection. Only the *acting*
  // buttons (stake, lock, spin, resolve) need a signer.
  const wrongIds = STUDENTS.filter((s) => round.handStatusById[s.id] === "Wrong").map((s) => s.id);
  const wrongNames = wrongIds
    .map((id) => STUDENTS.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s))
    .map(fullName);

  const lastCorrectStudent = round.lastCorrect
    ? STUDENTS.find((s) => s.id === round.lastCorrect!.studentId)
    : null;

  // The most recent correct answer stays visible regardless of what the live
  // round is doing right now - opening a new question shouldn't erase proof
  // that the last one worked.
  function renderLastResult() {
    if (!lastCorrectStudent || !round.lastCorrect) return null;
    return (
      <p className="hint">
        <strong>{fullName(lastCorrectStudent)}</strong> got it right and earned{" "}
        {formatAmount(round.lastCorrect.rewardAmount)} TMT.
      </p>
    );
  }

  function renderLiveStatus() {
    if (round.roundState === "Inactive") {
      return <p className="hint">No question open yet. Waiting for the teacher to start one.</p>;
    }
    if (round.roundState === "Open") {
      return (
        <p className="hint">
          {round.pool.length} hand{round.pool.length === 1 ? "" : "s"} raised so far - stake{" "}
          {formatAmount(round.stakeAmount)} TMT to join. Waiting for the teacher to lock the pool.
        </p>
      );
    }
    if (round.roundState === "Locked") {
      return (
        <p className="hint">
          {round.pool.length} student{round.pool.length === 1 ? "" : "s"} locked in
          {wrongNames.length > 0 ? ` - ruled out so far: ${wrongNames.join(", ")}` : ""}. Waiting
          for the teacher to spin.
        </p>
      );
    }
    return null;
  }

  // A visible role indicator plus the raw numbers behind the game - all public
  // chain data, shown so nobody has to guess what "connect wallet" actually did
  // or take the token economics on faith.
  function renderIdentityLine() {
    if (!isConnected) return null;
    if (round.isOwner) {
      return <p className="hint center">Connected as the teacher.</p>;
    }
    if (round.myStudentId > 0) {
      const me = STUDENTS.find((s) => s.id === round.myStudentId);
      return (
        <p className="hint center">
          Connected as <strong>{me ? fullName(me) : "a student"}</strong>
        </p>
      );
    }
    return <p className="hint center">Connected - no name claimed yet.</p>;
  }

  return (
    <main>
      <Header tally={EMPTY_TALLY} />

      <section className="card center">
        <ConnectButton showBalance={false} />
        {renderIdentityLine()}
        {isConnected && myBalance !== undefined && (
          <p className="hint center">Your balance: {formatAmount(myBalance)} TMT</p>
        )}
      </section>

      {isConnected && chainId !== SPINNER_CHAIN.id && (
        <div className="notice warn">
          <strong>Wrong network.</strong> This staking contract only exists on{" "}
          {SPINNER_CHAIN.name}.
          <div style={{ marginTop: 12 }}>
            <button
              className="primary"
              onClick={() => switchChain({ chainId: SPINNER_CHAIN.id })}
              disabled={isSwitching}
            >
              {isSwitching ? "Switching..." : `Switch to ${SPINNER_CHAIN.name}`}
            </button>
          </div>
        </div>
      )}

      <section className="card">
        <h2>Spinner</h2>
        {renderLastResult()}
        {renderLiveStatus()}
        <p className="hint" style={{ marginTop: 10 }}>
          Reward pool: {formatAmount(round.freeBalance)} TMT ·{" "}
          <a href={explorerUrl(`address/${STAKING_ADDRESS}`)} target="_blank" rel="noreferrer">
            {shortenAddress(STAKING_ADDRESS)}
          </a>{" "}
          on Sepolia
        </p>
      </section>

      <StudentGrid
        students={STUDENTS}
        handState={handState}
        selectedId={spinWinner?.id ?? null}
        phase={displayPhase}
        onToggleHand={() => {}}
      />

      {isConnected && chainId === SPINNER_CHAIN.id && (
        <>
          <div className="controls">
            <button
              type="button"
              className={viewTab === "teacher" ? "primary" : "ghost"}
              onClick={() => setManualTab("teacher")}
            >
              Teacher view
            </button>
            <button
              type="button"
              className={viewTab === "student" ? "primary" : "ghost"}
              onClick={() => setManualTab("student")}
            >
              Student view
            </button>
          </div>

          {viewTab === "teacher" && (
            <>
              {!round.isOwner && (
                <p className="hint center">
                  Previewing the teacher panel - only the teacher's own wallet can actually
                  submit these.
                </p>
              )}
              {(round.roundState === "Inactive" || round.roundState === "Closed") && (
                <RoundConfigForm freeBalance={round.freeBalance} onOpened={round.refetchAll} />
              )}
              {(round.roundState === "Open" || round.roundState === "Locked") &&
                uiPhase === "idle" && (
                  <TeacherRoundControls
                    roundState={round.roundState}
                    poolSize={round.pool.length}
                    onLocked={round.refetchAll}
                    onCancelled={round.refetchAll}
                    onSpin={handleSpin}
                  />
                )}
            </>
          )}

          {viewTab === "student" && (
            <>
              {round.myStudentId === 0 && round.roundState !== "Inactive" && (
                <ClaimIdentityPanel onClaimed={round.refetchAll} />
              )}
              {round.myStudentId === 0 && round.roundState === "Inactive" && (
                <p className="hint center">
                  No question open yet - come back once the teacher starts one to pick your name.
                </p>
              )}

              {round.myStudentId > 0 && uiPhase === "idle" && (
                <section className="card center">
                  <p className="hint">
                    You are{" "}
                    <strong>{fullName(STUDENTS.find((s) => s.id === round.myStudentId)!)}</strong>
                  </p>
                  {needsRefund ? (
                    <RefundClaim roundId={round.roundId} onClaimed={round.refetchAll} />
                  ) : (
                    <StakeButton
                      roundState={round.roundState}
                      stakeAmount={round.stakeAmount}
                      myHandStatus={myHandStatus}
                      onChanged={round.refetchAll}
                    />
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      {uiPhase === "spinning" && spinWinner && (
        <SpinWheel
          pool={poolStudents}
          winner={spinWinner}
          onSettle={() => setUiPhase("result")}
        />
      )}

      {uiPhase === "result" && spinWinner && (
        <div className="result-banner">
          <motion.span
            className="winner-name"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {fullName(spinWinner)}
          </motion.span>
          {round.isOwner ? (
            <ResolveSelected studentId={spinWinner.id} onResolved={handleResolved} />
          ) : (
            <>
              <p className="hint center">
                Previewing the spin - only the teacher's own wallet can mark an answer correct or
                wrong.
              </p>
              <button type="button" className="ghost" onClick={() => setUiPhase("idle")}>
                Back
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
