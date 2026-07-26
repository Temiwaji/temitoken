"use client";

import { useCallback, useEffect, useState } from "react";
import { erc20Abi } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWatchAsset,
} from "wagmi";

import { TOKEN_ADDRESS, TOKEN_CHAIN, isTokenConfigured } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import { TransferForm } from "./TransferForm";

const token = {
  address: TOKEN_ADDRESS,
  abi: erc20Abi,
  chainId: TOKEN_CHAIN.id,
} as const;

/** Wagmi renders differently on the server than after the wallet reconnects,
 *  so hold everything wallet-dependent back until the client has mounted. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function WalletPanel() {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { watchAsset } = useWatchAsset();

  const { data: meta } = useReadContracts({
    contracts: [
      { ...token, functionName: "symbol" },
      { ...token, functionName: "decimals" },
    ],
    query: { enabled: isTokenConfigured },
  });

  const symbol = meta?.[0]?.result;
  const decimals = meta?.[1]?.result;

  const { data: balance, refetch } = useReadContract({
    ...token,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isTokenConfigured && Boolean(address) },
  });

  const handleSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <div className="notice info">
        Connect a wallet to see your balance and send {symbol ?? "tokens"}.
        Connecting only shares your public address - a website can never move
        your tokens on its own.
      </div>
    );
  }

  if (chainId !== TOKEN_CHAIN.id) {
    return (
      <div className="notice warn">
        <strong>Wrong network.</strong> This token only exists on{" "}
        {TOKEN_CHAIN.name}. Switch networks to continue.
        <div style={{ marginTop: 12 }}>
          <button
            className="primary"
            onClick={() => switchChain({ chainId: TOKEN_CHAIN.id })}
            disabled={isSwitching}
          >
            {isSwitching ? "Switching..." : `Switch to ${TOKEN_CHAIN.name}`}
          </button>
        </div>
      </div>
    );
  }

  if (!isTokenConfigured) return null;

  return (
    <>
      <section className="card">
        <h2>Your balance</h2>
        <div className="balance">
          <span className="amount">
            {balance !== undefined && decimals !== undefined
              ? formatAmount(balance, decimals)
              : "..."}
          </span>
          <span className="unit">{symbol}</span>
        </div>
        <p className="hint center">
          <button
            type="button"
            className="link"
            onClick={() =>
              watchAsset({
                type: "ERC20",
                options: {
                  address: TOKEN_ADDRESS,
                  symbol: symbol ?? "TMT",
                  decimals: decimals ?? 18,
                },
              })
            }
          >
            add {symbol ?? "this token"} to my wallet
          </button>
        </p>
      </section>

      {decimals !== undefined && symbol !== undefined && balance !== undefined && (
        <TransferForm
          decimals={decimals}
          symbol={symbol}
          balance={balance}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
