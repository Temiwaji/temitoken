import type { BaseError } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { STAKING_ADDRESS } from "../../lib/config";
import { stakingAbi } from "../../lib/stakingAbi";
import type { RoundState } from "../../state/useOnChainRound";

interface Props {
  roundState: RoundState;
  poolSize: number;
  onLocked: () => void;
  onCancelled: () => void;
  onSpin: () => void;
}

export function TeacherRoundControls({ roundState, poolSize, onLocked, onCancelled, onSpin }: Props) {
  const lockTx = useWriteContract();
  const lockReceipt = useWaitForTransactionReceipt({ hash: lockTx.data });
  if (lockReceipt.isSuccess) {
    lockTx.reset();
    onLocked();
  }

  const cancelTx = useWriteContract();
  const cancelReceipt = useWaitForTransactionReceipt({ hash: cancelTx.data });
  if (cancelReceipt.isSuccess) {
    cancelTx.reset();
    onCancelled();
  }

  const busy =
    lockTx.isPending || lockReceipt.isLoading || cancelTx.isPending || cancelReceipt.isLoading;

  return (
    <div className="controls">
      {roundState === "Open" && (
        <button
          type="button"
          className="primary"
          disabled={poolSize === 0 || busy}
          onClick={() =>
            lockTx.writeContract({ address: STAKING_ADDRESS, abi: stakingAbi, functionName: "lockPool" })
          }
        >
          {lockTx.isPending || lockReceipt.isLoading ? "Locking..." : `Lock hands (${poolSize})`}
        </button>
      )}

      {roundState === "Locked" && (
        <button type="button" className="event" disabled={poolSize === 0} onClick={onSpin}>
          Spin ({poolSize} in the pool)
        </button>
      )}

      {(roundState === "Open" || roundState === "Locked") && (
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={() =>
            cancelTx.writeContract({
              address: STAKING_ADDRESS,
              abi: stakingAbi,
              functionName: "cancelRound",
            })
          }
        >
          {cancelTx.isPending || cancelReceipt.isLoading ? "Cancelling..." : "Cancel question"}
        </button>
      )}

      {(lockTx.error || cancelTx.error) && (
        <p className="error-text">
          {((lockTx.error ?? cancelTx.error) as BaseError).shortMessage ??
            (lockTx.error ?? cancelTx.error)?.message}
        </p>
      )}
    </div>
  );
}
