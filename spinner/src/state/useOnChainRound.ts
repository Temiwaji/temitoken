import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { STAKING_ADDRESS } from "../lib/config";
import { stakingAbi } from "../lib/stakingAbi";
import { STUDENTS } from "../data/roster";

const staking = { address: STAKING_ADDRESS, abi: stakingAbi } as const;

export type RoundState = "Inactive" | "Open" | "Locked" | "Closed";
export type OnChainHandStatus = "None" | "Raised" | "Wrong" | "Correct" | "Refunded";

const ROUND_STATES: RoundState[] = ["Inactive", "Open", "Locked", "Closed"];
const HAND_STATUSES: OnChainHandStatus[] = ["None", "Raised", "Wrong", "Correct", "Refunded"];

const POLL_INTERVAL_MS = 4000;

export function useOnChainRound() {
  const { address } = useAccount();

  const { data: roundId, refetch: refetchRoundId } = useReadContract({
    ...staking,
    functionName: "currentRoundId",
    query: { refetchInterval: POLL_INTERVAL_MS },
  });

  const { data: round, refetch: refetchRound } = useReadContract({
    ...staking,
    functionName: "currentRound",
    query: { refetchInterval: POLL_INTERVAL_MS },
  });

  const { data: pool, refetch: refetchPool } = useReadContract({
    ...staking,
    functionName: "getPool",
    args: roundId !== undefined ? [roundId] : undefined,
    query: { enabled: roundId !== undefined, refetchInterval: POLL_INTERVAL_MS },
  });

  const { data: owner } = useReadContract({ ...staking, functionName: "owner" });

  const { data: myStudentId, refetch: refetchMyId } = useReadContract({
    ...staking,
    functionName: "studentIdOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: POLL_INTERVAL_MS },
  });

  const { data: freeBalance, refetch: refetchFreeBalance } = useReadContract({
    ...staking,
    functionName: "freeBalance",
    query: { refetchInterval: POLL_INTERVAL_MS },
  });

  const handStatusCalls = useMemo(
    () =>
      STUDENTS.map((s) => ({
        ...staking,
        functionName: "handStatus" as const,
        args: roundId !== undefined ? ([roundId, BigInt(s.id)] as const) : undefined,
      })),
    [roundId]
  );

  const { data: handStatusResults, refetch: refetchHandStatus } = useReadContracts({
    contracts: handStatusCalls,
    query: { enabled: roundId !== undefined, refetchInterval: POLL_INTERVAL_MS },
  });

  const handStatusById = useMemo(() => {
    const map: Record<number, OnChainHandStatus> = {};
    STUDENTS.forEach((s, i) => {
      const raw = handStatusResults?.[i]?.result as number | undefined;
      map[s.id] = HAND_STATUSES[raw ?? 0];
    });
    return map;
  }, [handStatusResults]);

  function refetchAll() {
    refetchRoundId();
    refetchRound();
    refetchPool();
    refetchMyId();
    refetchFreeBalance();
    refetchHandStatus();
  }

  return {
    roundId: roundId ?? 0n,
    roundState: ROUND_STATES[round?.state ?? 0],
    stakeAmount: round?.stakeAmount ?? 0n,
    rewardAmount: round?.rewardAmount ?? 0n,
    penaltyAmount: round?.penaltyAmount ?? 0n,
    pool: (pool ?? []).map((id) => Number(id)),
    handStatusById,
    owner,
    isOwner: Boolean(address && owner && address.toLowerCase() === owner.toLowerCase()),
    myStudentId: Number(myStudentId ?? 0n),
    freeBalance: freeBalance ?? 0n,
    refetchAll,
  };
}
