"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { useState, type ReactNode } from "react";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TOKEN_CHAIN, WALLETCONNECT_PROJECT_ID } from "@/lib/config";

const config = getDefaultConfig({
  appName: "TemiToken Dapp",
  // A placeholder keeps the app rendering when the id is not set yet; only the
  // WalletConnect QR flow needs a real one, injected wallets work regardless.
  projectId: WALLETCONNECT_PROJECT_ID || "walletconnect-project-id-not-set",
  chains: [TOKEN_CHAIN],
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#6366f1" })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
