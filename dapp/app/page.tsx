"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { TokenInfo } from "@/components/TokenInfo";
import { WalletPanel } from "@/components/WalletPanel";
import {
  TOKEN_CHAIN,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  isTokenConfigured,
  isWalletConnectConfigured,
} from "@/lib/config";

export default function Home() {
  return (
    <main>
      <header className="hero">
        <h1>
          {TOKEN_NAME} ({TOKEN_SYMBOL})
        </h1>
        <p className="tagline">
          A fixed-supply ERC20 token on {TOKEN_CHAIN.name}. Connect your wallet
          to check your balance and send tokens.
        </p>
        <ConnectButton showBalance={false} />
      </header>

      {!isTokenConfigured && (
        <div className="notice warn">
          <strong>No contract address set.</strong> Deploy the contract, then
          set <code>NEXT_PUBLIC_TOKEN_ADDRESS</code> in the environment (or in{" "}
          <code>lib/config.ts</code>) and reload.
        </div>
      )}

      {!isWalletConnectConfigured && (
        <div className="notice warn">
          <strong>No WalletConnect project id set.</strong> Browser wallet
          extensions still work, but phone wallets need{" "}
          <code>NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> (free at
          cloud.reown.com).
        </div>
      )}

      <WalletPanel />

      <TokenInfo />

      <footer>
        Test network only - {TOKEN_SYMBOL} has no monetary value.
        <br />
        This site never sees your private key or seed phrase, and no website can
        move your tokens without a transaction you sign yourself.
      </footer>
    </main>
  );
}
