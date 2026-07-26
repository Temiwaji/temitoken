import { useState } from "react";
import { parseUnits, type BaseError } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { STAKING_ADDRESS } from "../../lib/config";
import { stakingAbi } from "../../lib/stakingAbi";
import { formatAmount } from "../../lib/format";

interface Props {
  freeBalance: bigint;
  onOpened: () => void;
}

export function RoundConfigForm({ freeBalance, onOpened }: Props) {
  const [stake, setStake] = useState("10");
  const [reward, setReward] = useState("5");
  const [penalty, setPenalty] = useState("4");

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) onOpened();

  function handleOpen() {
    try {
      writeContract({
        address: STAKING_ADDRESS,
        abi: stakingAbi,
        functionName: "openRound",
        args: [parseUnits(stake, 18), parseUnits(reward, 18), parseUnits(penalty, 18)],
      });
    } catch {
      // parseUnits throws on malformed input - the disabled state below already
      // guards the common case, this just stops a bad string reaching wagmi.
    }
  }

  const valid =
    Number(stake) > 0 && Number(reward) >= 0 && Number(penalty) >= 0 && Number(penalty) <= Number(stake);

  return (
    <section className="card">
      <h2>Open a question</h2>
      <div className="field">
        <label htmlFor="stake">Stake to raise a hand (TMT)</label>
        <input id="stake" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="reward">Reward for a correct answer (TMT)</label>
        <input id="reward" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="penalty">Penalty for a wrong answer (TMT, capped at stake)</label>
        <input id="penalty" inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} />
      </div>
      <p className="hint">Reward pool available: {formatAmount(freeBalance, 18, 0)} TMT</p>
      <button type="button" className="primary" disabled={!valid || isPending || isConfirming} onClick={handleOpen}>
        {isPending ? "Confirm in your wallet..." : isConfirming ? "Opening..." : "Open question"}
      </button>
      {error && <p className="error-text">{(error as BaseError).shortMessage ?? error.message}</p>}
    </section>
  );
}
