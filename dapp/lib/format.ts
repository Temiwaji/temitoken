import { formatUnits } from "viem";

/**
 * Turn a raw on-chain integer into a human string, e.g.
 * 1000000000000000000000n with 18 decimals -> "1,000".
 * Never use plain division for this: token amounts are bigints and floats lose
 * precision well below 18 decimals.
 */
export function formatAmount(
  value: bigint,
  decimals: number,
  maxFractionDigits = 4
): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, "");
  const grouped = BigInt(whole).toLocaleString("en-US");
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

/** 0x1234...abcd */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
