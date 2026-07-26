import { useState } from "react";
import type { BaseError } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { STAKING_ADDRESS } from "../../lib/config";
import { stakingAbi } from "../../lib/stakingAbi";
import { STUDENTS, fullName } from "../../data/roster";

interface Props {
  onClaimed: () => void;
}

export function ClaimIdentityPanel({ onClaimed }: Props) {
  const [selected, setSelected] = useState<number | "">("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) onClaimed();

  return (
    <section className="card">
      <h2>Who are you?</h2>
      <p className="hint">
        Pick your name once - it gets permanently linked to this wallet on-chain, so nobody
        else can raise a hand as you.
      </p>
      <div className="field">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select your name...</option>
          {STUDENTS.map((s) => (
            <option key={s.id} value={s.id}>
              {fullName(s)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="primary"
        disabled={selected === "" || isPending || isConfirming}
        onClick={() =>
          writeContract({
            address: STAKING_ADDRESS,
            abi: stakingAbi,
            functionName: "claimIdentity",
            args: [BigInt(selected)],
          })
        }
      >
        {isPending ? "Confirm in your wallet..." : isConfirming ? "Claiming..." : "That's me"}
      </button>
      {error && <p className="error-text">{(error as BaseError).shortMessage ?? error.message}</p>}
    </section>
  );
}
