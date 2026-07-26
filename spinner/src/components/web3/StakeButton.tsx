import { erc20Abi, type BaseError } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { STAKING_ADDRESS, TOKEN_ADDRESS } from "../../lib/config";
import { stakingAbi } from "../../lib/stakingAbi";
import { formatAmount } from "../../lib/format";
import type { RoundState, OnChainHandStatus } from "../../state/useOnChainRound";

interface Props {
  roundState: RoundState;
  stakeAmount: bigint;
  myHandStatus: OnChainHandStatus;
  onChanged: () => void;
}

export function StakeButton({ roundState, stakeAmount, myHandStatus, onChanged }: Props) {
  const { address } = useAccount();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, STAKING_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    refetchAllowance();
    onChanged();
  }

  if (roundState !== "Open") {
    if (myHandStatus === "Raised") {
      return <p className="notice info">Waiting for the teacher to lock the pool...</p>;
    }
    return null;
  }

  if (myHandStatus === "Raised") {
    return (
      <button
        type="button"
        className="danger"
        disabled={isPending || isConfirming}
        onClick={() => {
          reset();
          writeContract({
            address: STAKING_ADDRESS,
            abi: stakingAbi,
            functionName: "lowerHand",
          });
        }}
      >
        {isPending ? "Confirm in your wallet..." : isConfirming ? "Lowering..." : "Lower hand"}
      </button>
    );
  }

  const needsApproval = allowance === undefined || allowance < stakeAmount;

  return (
    <div className="stack">
      <p className="hint">Stake required: {formatAmount(stakeAmount)} TMT</p>
      {needsApproval ? (
        <button
          type="button"
          className="primary"
          disabled={isPending || isConfirming}
          onClick={() => {
            reset();
            writeContract({
              address: TOKEN_ADDRESS,
              abi: erc20Abi,
              functionName: "approve",
              args: [STAKING_ADDRESS, stakeAmount],
            });
          }}
        >
          {isPending ? "Confirm in your wallet..." : isConfirming ? "Approving..." : "Approve TMT"}
        </button>
      ) : (
        <button
          type="button"
          className="event"
          disabled={isPending || isConfirming}
          onClick={() => {
            reset();
            writeContract({
              address: STAKING_ADDRESS,
              abi: stakingAbi,
              functionName: "raiseHand",
            });
          }}
        >
          {isPending ? "Confirm in your wallet..." : isConfirming ? "Raising..." : "Raise hand"}
        </button>
      )}
      {error && <p className="error-text">{(error as BaseError).shortMessage ?? error.message}</p>}
    </div>
  );
}
