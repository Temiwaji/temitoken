const { ethers, network } = require("hardhat");

const STUDENT_COUNT = 14;
const DEFAULT_TOKEN_ADDRESS = "0xc80AAD29a6De0bb8b7A8caa3f1103C8ecF6A71E0"; // TemiToken on Sepolia
const REWARD_POOL_SEED = ethers.parseUnits("5000", 18); // TMT the teacher pre-funds the pool with

async function main() {
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No deployer account found. Put your PRIVATE_KEY in contract/.env first."
    );
  }

  const tokenAddress = process.env.TEMITOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`Network:      ${network.name}`);
  console.log(`Deployer:     ${deployer.address}`);
  console.log(`ETH balance:  ${ethers.formatEther(balance)} ETH`);
  console.log(`TemiToken:    ${tokenAddress}`);

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 ETH on this network - fund it from a faucet before deploying."
    );
  }

  console.log("\nDeploying ClassSpinnerStaking...");
  const staking = await ethers.deployContract("ClassSpinnerStaking", [
    tokenAddress,
    deployer.address,
    STUDENT_COUNT,
  ]);
  await staking.waitForDeployment();

  const address = await staking.getAddress();
  const deployTx = staking.deploymentTransaction();

  if (deployTx && network.name !== "hardhat") {
    console.log(`Tx hash: ${deployTx.hash}`);
    console.log("Waiting for 5 confirmations...");
    await deployTx.wait(5);
  }

  console.log("\n=== Deployed ===");
  console.log(`Address:       ${address}`);
  console.log(`Owner:         ${await staking.owner()}`);
  console.log(`Student count: ${await staking.studentCount()}`);

  console.log(`\nSeeding the reward pool with ${ethers.formatUnits(REWARD_POOL_SEED, 18)} TMT...`);
  const token = await ethers.getContractAt("TemiToken", tokenAddress);
  const approveTx = await token.approve(address, REWARD_POOL_SEED);
  await approveTx.wait();
  const fundTx = await staking.fundRewards(REWARD_POOL_SEED);
  await fundTx.wait();
  console.log(`Free balance:  ${ethers.formatUnits(await staking.freeBalance(), 18)} TMT`);

  console.log(
    `\nVerify with:\n  npx hardhat verify --network ${network.name} ${address} ${tokenAddress} ${deployer.address} ${STUDENT_COUNT}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
