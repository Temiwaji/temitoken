import { sepolia } from "wagmi/chains";
import { isAddress } from "viem";

/**
 * These are all PUBLIC values, safe to commit and share - Vite inlines
 * anything prefixed VITE_ into the client bundle at build time. Secrets
 * (private keys, RPC keys) never belong in this folder.
 */

export const TOKEN_ADDRESS = (import.meta.env.VITE_TOKEN_ADDRESS ||
  "0xc80AAD29a6De0bb8b7A8caa3f1103C8ecF6A71E0") as `0x${string}`;

export const STAKING_ADDRESS = (import.meta.env.VITE_STAKING_ADDRESS || "") as `0x${string}`;

export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

export const SPINNER_CHAIN = sepolia;

export const isStakingConfigured = isAddress(STAKING_ADDRESS);
export const isWalletConnectConfigured = WALLETCONNECT_PROJECT_ID.length > 0;

export const explorerUrl = (path: string) =>
  `${SPINNER_CHAIN.blockExplorers.default.url}/${path}`;
