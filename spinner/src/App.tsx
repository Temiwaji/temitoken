import LocalSpinnerApp from "./LocalSpinnerApp";
import { Providers } from "./components/web3/Providers";
import { StakingView } from "./components/web3/StakingView";
import { isStakingConfigured } from "./lib/config";

export default function App() {
  if (!isStakingConfigured) {
    return <LocalSpinnerApp />;
  }

  return (
    <Providers>
      <StakingView />
    </Providers>
  );
}
