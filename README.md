# TemiToken (TMT)

A fixed-supply ERC20 token and a web dapp for sending it, built for a blockchain
class project.

- **Token:** TemiToken (`TMT`), 1,000,000,000 fixed supply, 18 decimals
- **Network:** Ethereum Sepolia testnet (chain id `11155111`)
- **Contract address:** [`0xc80AAD29a6De0bb8b7A8caa3f1103C8ecF6A71E0`](https://sepolia.etherscan.io/address/0xc80AAD29a6De0bb8b7A8caa3f1103C8ecF6A71E0#code) (verified on Etherscan)
- **Live dapp:** https://dapp-pi-green.vercel.app
- **Repo:** https://github.com/Temiwaji/temitoken
- **Classroom spinner + staking:** https://spinner-swart-six.vercel.app
- **Staking contract:** [`0x1dE2c9c7B01A8c6e4d4fe9b6bcF9ef87E529Ef0f`](https://sepolia.etherscan.io/address/0x1dE2c9c7B01A8c6e4d4fe9b6bcF9ef87E529Ef0f#code) (verified on Etherscan, funded with 5,000 TMT)

TMT is a testnet token. It has no monetary value and cannot be bought or sold.

## What makes this token safe to hold

The contract is 18 lines and inherits OpenZeppelin's audited ERC20. It has:

- **No owner.** There is no admin account, so nobody can change anything.
- **No mint function.** The entire supply is created once in the constructor.
  The total supply can never increase.
- **No pause, no blacklist, no transfer tax.** Nobody can freeze your balance
  or take a cut of a transfer.

The test suite asserts this directly: one test reads the compiled ABI and fails
if the contract exposes anything beyond the ten standard ERC20 functions.

## Repository layout

```
contract/    Hardhat project - both Solidity contracts, tests, deploy scripts
dapp/        Next.js app - connect wallet, view balance, send tokens
spinner/     Vite app - classroom "who answers next" spinner + token staking
```

## Running the contract project

```bash
cd contract
npm install
npx hardhat test
```

To deploy, create `contract/.env` from `contract/.env.example` and fill in:

| Variable | Where it comes from |
| --- | --- |
| `SEPOLIA_RPC_URL` | alchemy.com, create a Sepolia app, copy the HTTPS URL |
| `PRIVATE_KEY` | your deployer wallet's private key |
| `ETHERSCAN_API_KEY` | etherscan.io, API Keys |

Then:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

and verify the source on Etherscan:

```bash
npx hardhat verify --network sepolia <deployed-address>
```

## Running the dapp

```bash
cd dapp
npm install
npm run dev
```

Open http://localhost:3000. Copy `dapp/.env.local.example` to `.env.local` and
set `NEXT_PUBLIC_TOKEN_ADDRESS` and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
Both of those are public values, safe to commit and share.

The dapp reads the token's name, symbol, decimals, total supply and your
balance straight from the chain, and can send TMT to any address. It validates
the recipient's address checksum, blocks amounts larger than your balance, and
refuses to act while your wallet is on the wrong network.

## Classroom spinner + staking

A "who answers next" spinner for the classroom, in two layers:

- **Without a contract configured**, it's a plain teacher-operated spinner: request
  a question, tap a student's card when their hand goes up, lock the pool, spin,
  mark the pick correct or wrong (wrong removes them and lets you spin again). No
  wallet, no blockchain.
- **With `ClassSpinnerStaking` deployed**, hand-raising is gated by a real TMT
  stake. Each student connects their own wallet, picks their name once (bound to
  that wallet on-chain, permanently), and stakes TMT to raise a hand. The teacher
  sets the stake/reward/penalty amounts per question. A correct answer pays the
  stake back plus the reward, out of the contract's own balance; a wrong answer
  keeps the penalty (capped at the stake) and refunds the rest; anyone left in the
  pool when a round closes can claim their stake back. The contract itself is the
  shared source of truth — the teacher's screen and every student's device just
  read the same chain state, no separate backend.

`contract/contracts/ClassSpinnerStaking.sol` is the new contract (TemiToken is
immutable, so this logic couldn't live there). Run its tests the same way:

```bash
cd contract
npx hardhat test
```

Deploy and verify it the same way as TemiToken:

```bash
npx hardhat run scripts/deployStaking.js --network sepolia
npx hardhat verify --network sepolia <address> <tokenAddress> <teacherAddress> <studentCount>
```

Then fund its reward pool from the teacher wallet before opening the first round
(`fundRewards`, or a plain TMT transfer to the contract address) — `openRound`
reverts if the contract can't already cover the reward.

```bash
cd spinner
npm install
npm run dev
```

Open http://localhost:5173. Copy `spinner/.env.local.example` to `.env.local` and
set `VITE_TOKEN_ADDRESS`, `VITE_STAKING_ADDRESS` (leave blank to run in
no-wallet mode) and `VITE_WALLETCONNECT_PROJECT_ID`. All public values, safe to
commit and share.

## How to receive TMT

Send the token holder your **wallet address** — the `0x...` string. That is
public information and is safe to share. They open the dapp, connect, paste
your address and send. To see the token in your own wallet, add it by its
contract address.

Your **private key and seed phrase** are never needed for any of this, and must
never be shared with anyone or typed into any website.

## Security notes

- The token logic comes from OpenZeppelin. No balance or allowance arithmetic
  was written by hand.
- Secrets live only in `contract/.env`, which is git-ignored. No key is in the
  source, the commit history, or the dapp bundle.
- The contract was deployed from a fresh wallet holding no real assets.
- Everything was tested on Sepolia. No mainnet deployment.

## Stack

Hardhat 2, OpenZeppelin Contracts 5.6.1, Solidity 0.8.24 (pinned),
Next.js 14, Vite 5, wagmi 2, viem 2, RainbowKit 2, Framer Motion, deployed on
Vercel.

## Author

Temiwaji — https://github.com/Temiwaji
