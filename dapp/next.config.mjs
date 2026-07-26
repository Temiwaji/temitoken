/**
 * Wagmi's Base Account connector imports Coinbase's payment SDK, which in turn
 * imports these "@x402/*" packages without declaring them as dependencies, so
 * they are simply not on disk. This dapp only talks to Sepolia through injected
 * and WalletConnect wallets and never touches that connector, so resolving them
 * to an empty module is safe and keeps the build from failing on code we do not
 * ship.
 */
const unusedPaymentSdkModules = [
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm/exact/client",
  // The MetaMask SDK's React Native storage import: only used inside a mobile
  // app, and does not exist in a browser build. Scoped package names contain
  // "@" and "/", which webpack's string-form `externals` cannot express as a
  // valid identifier, so this has to be resolved away here instead.
  "@react-native-async-storage/async-storage",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // WalletConnect pulls in an optional native dependency that has no browser
    // build. Marking it external keeps the bundle from failing on Vercel.
    config.externals.push("pino-pretty", "lokijs", "encoding");

    for (const moduleName of unusedPaymentSdkModules) {
      config.resolve.alias[moduleName] = false;
    }

    return config;
  },
};

export default nextConfig;
