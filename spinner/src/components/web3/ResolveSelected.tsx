import type { BaseError } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { STAKING_ADDRESS } from "../../lib/config";
import { stakingAbi } from "../../lib/stakingAbi";

interface Props {
  studentId: number;
  onResolved: () => void;
}

export function ResolveSelected({ studentId, onResolved }: Props) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    reset();
    onResolved();
  }

  const busy = isPending || isConfirming;

  function resolve(correct: boolean) {
    writeContract({
      address: STAKING_ADDRESS,
      abi: stakingAbi,
      functionName: "resolveSelected",
      args: [BigInt(studentId), correct],
    });
  }

  return (
    <div className="result-actions">
      <button type="button" className="success" disabled={busy} onClick={() => resolve(true)}>
        {busy ? "Confirming..." : "Correct"}
      </button>
      <button type="button" className="danger" disabled={busy} onClick={() => resolve(false)}>
        {busy ? "Confirming..." : "Wrong"}
      </button>
      {error && <p className="error-text">{(error as BaseError).shortMessage ?? error.message}</p>}
    </div>
  );
}
