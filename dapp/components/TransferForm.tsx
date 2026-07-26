"use client";

import { useEffect, useState } from "react";
import { erc20Abi, getAddress, isAddress, parseUnits, type BaseError } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { TOKEN_ADDRESS, TOKEN_CHAIN, explorerUrl } from "@/lib/config";
import { formatAmount } from "@/lib/format";

type Props = {
  decimals: number;
  symbol: string;
  balance: bigint;
  onSuccess: () => void;
};

/**
 * Accepts a lower-case, upper-case or checksummed address and returns it
 * checksummed. A mixed-case address whose checksum does not match is almost
 * always a typo, and getAddress throws on exactly that case.
 */
function parseRecipient(input: string): {
  address?: `0x${string}`;
  error?: string;
} {
  const value = input.trim();
  if (!value) return {};
  if (!isAddress(value, { strict: false })) {
    return { error: "Not a valid address. It should start with 0x and be 42 characters." };
  }
  try {
    return { address: getAddress(value) };
  } catch {
    return { error: "That address fails its checksum - it is probably a typo." };
  }
}

function parseAmount(
  input: string,
  decimals: number,
  balance: bigint
): { value?: bigint; error?: string } {
  const value = input.trim();
  if (!value) return {};
  if (!/^\d*\.?\d*$/.test(value)) {
    return { error: "Numbers only." };
  }

  const [, fraction = ""] = value.split(".");
  if (fraction.length > decimals) {
    return { error: `At most ${decimals} decimal places.` };
  }

  let parsed: bigint;
  try {
    parsed = parseUnits(value, decimals);
  } catch {
    return { error: "Could not read that amount." };
  }

  if (parsed <= 0n) return { error: "Enter an amount above zero." };
  if (parsed > balance) return { error: "That is more than your balance." };

  return { value: parsed };
}

export function TransferForm({ decimals, symbol, balance, onSuccess }: Props) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const recipient = parseRecipient(to);
  const parsedAmount = parseAmount(amount, decimals, balance);

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      setTo("");
      setAmount("");
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  const canSubmit =
    Boolean(recipient.address) &&
    Boolean(parsedAmount.value) &&
    !isPending &&
    !isConfirming;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!recipient.address || !parsedAmount.value) return;

    writeContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient.address, parsedAmount.value],
      chainId: TOKEN_CHAIN.id,
    });
  }

  return (
    <section className="card">
      <h2>Send {symbol}</h2>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="to">Recipient address</label>
          <input
            id="to"
            className="mono"
            placeholder="0x..."
            value={to}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              setTo(event.target.value);
              reset();
            }}
          />
          {recipient.error && <p className="error-text">{recipient.error}</p>}
        </div>

        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            autoComplete="off"
            onChange={(event) => {
              setAmount(event.target.value);
              reset();
            }}
          />
          {parsedAmount.error && (
            <p className="error-text">{parsedAmount.error}</p>
          )}
          <p className="hint">
            Balance: {formatAmount(balance, decimals)} {symbol}{" "}
            <button
              type="button"
              className="link"
              onClick={() => setAmount(formatAmount(balance, decimals, decimals).replace(/,/g, ""))}
            >
              use max
            </button>
          </p>
        </div>

        <button className="primary" type="submit" disabled={!canSubmit}>
          {isPending
            ? "Confirm in your wallet..."
            : isConfirming
              ? "Sending..."
              : `Send ${symbol}`}
        </button>
      </form>

      {error && (
        <p className="error-text">
          {(error as BaseError).shortMessage ?? error.message}
        </p>
      )}

      {isSuccess && receipt && (
        <div className="notice ok" style={{ marginTop: 14 }}>
          Sent.{" "}
          <a
            href={explorerUrl(`tx/${receipt.transactionHash}`)}
            target="_blank"
            rel="noreferrer"
          >
            View the transaction
          </a>
        </div>
      )}
    </section>
  );
}
