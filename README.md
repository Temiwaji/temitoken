# TemiToken (TMT)

A fixed-supply ERC20 token and a web dapp for sending it, built for a blockchain
class project.

- **Token:** TemiToken (`TMT`), 1,000,000,000 fixed supply, 18 decimals
- **Network:** Ethereum Sepolia testnet (chain id `11155111`)
- **Contract address:** _filled in after deployment_
- **Live dapp:** _filled in after deployment_

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
contract/    Hardhat project - the Solidity contract, tests, deploy script
dapp/        Next.js app - connect wallet, view balance, send tokens
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
Next.js 14, wagmi 2, viem 2, RainbowKit 2, deployed on Vercel.

## Author

Temiwaji — https://github.com/Temiwaji
