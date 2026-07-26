"use client";

import { erc20Abi } from "viem";
import { useReadContracts } from "wagmi";

import {
  TOKEN_ADDRESS,
  TOKEN_CHAIN,
  explorerUrl,
  isTokenConfigured,
} from "@/lib/config";
import { formatAmount } from "@/lib/format";

const token = {
  address: TOKEN_ADDRESS,
  abi: erc20Abi,
  chainId: TOKEN_CHAIN.id,
} as const;

export function TokenInfo() {
  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      { ...token, functionName: "name" },
      { ...token, functionName: "symbol" },
      { ...token, functionName: "decimals" },
      { ...token, functionName: "totalSupply" },
    ],
    query: { enabled: isTokenConfigured },
  });

  const name = data?.[0]?.result;
  const symbol = data?.[1]?.result;
  const decimals = data?.[2]?.result;
  const totalSupply = data?.[3]?.result;

  return (
    <section className="card">
      <h2>Token</h2>

      {isLoading && <p className="hint">Reading the contract...</p>}

      {isError && (
        <p className="error-text">
          Could not read the contract. Check that the address is right and that
          it is deployed on {TOKEN_CHAIN.name}.
        </p>
      )}

      <div className="row">
        <span className="label">Name</span>
        <span className="value">{name ?? "-"}</span>
      </div>
      <div className="row">
        <span className="label">Symbol</span>
        <span className="value">{symbol ?? "-"}</span>
      </div>
      <div className="row">
        <span className="label">Decimals</span>
        <span className="value">{decimals ?? "-"}</span>
      </div>
      <div className="row">
        <span className="label">Total supply</span>
        <span className="value">
          {totalSupply !== undefined && decimals !== undefined
            ? `${formatAmount(totalSupply, decimals, 0)} ${symbol ?? ""}`
            : "-"}
        </span>
      </div>
      <div className="row">
        <span className="label">Network</span>
        <span className="value">{TOKEN_CHAIN.name}</span>
      </div>
      <div className="row">
        <span className="label">Contract</span>
        <span className="value mono">
          {isTokenConfigured ? (
            <a
              href={explorerUrl(`address/${TOKEN_ADDRESS}`)}
              target="_blank"
              rel="noreferrer"
            >
              {TOKEN_ADDRESS}
            </a>
          ) : (
            "not set"
          )}
        </span>
      </div>
    </section>
  );
}
