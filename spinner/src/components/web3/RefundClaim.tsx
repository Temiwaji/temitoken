import type { BaseError } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { STAKING_ADDRESS } from "../../lib/config";
import { stakingAbi } from "../../lib/stakingAbi";

interface Props {
  roundId: bigint;
  onClaimed: () => void;
}

export function RefundClaim({ roundId, onClaimed }: Props) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) onClaimed();

  return (
    <div className="notice info">
      The question closed before you were picked - your stake is waiting for you.
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="primary"
          disabled={isPending || isConfirming}
          onClick={() =>
            writeContract({
              address: STAKING_ADDRESS,
              abi: stakingAbi,
              functionName: "withdrawRefund",
              args: [roundId],
            })
          }
        >
          {isPending ? "Confirm in your wallet..." : isConfirming ? "Claiming..." : "Claim refund"}
        </button>
      </div>
      {error && <p className="error-text">{(error as BaseError).shortMessage ?? error.message}</p>}
    </div>
  );
}
