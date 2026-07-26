import { sepolia } from "wagmi/chains";
import { isAddress } from "viem";

/**
 * Both values below are PUBLIC. They ship to the browser in every dapp and are
 * safe to commit and safe to share. Secrets (private keys, RPC keys) never
 * belong in this folder.
 */

// Deployed TemiToken contract address. Set NEXT_PUBLIC_TOKEN_ADDRESS in the
// environment, or paste the address into the fallback string below.
export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
  "") as `0x${string}`;

// Free WalletConnect / Reown project id from cloud.reown.com. Without it the
// QR-code and mobile wallet flows do not work, but injected browser wallets do.
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

/** The one chain this dapp talks to. */
export const TOKEN_CHAIN = sepolia;

export const TOKEN_NAME = "TemiToken";
export const TOKEN_SYMBOL = "TMT";

export const isTokenConfigured = isAddress(TOKEN_ADDRESS);
export const isWalletConnectConfigured = WALLETCONNECT_PROJECT_ID.length > 0;

export const explorerUrl = (path: string) =>
  `${TOKEN_CHAIN.blockExplorers.default.url}/${path}`;
