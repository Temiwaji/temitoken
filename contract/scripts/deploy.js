const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No deployer account found. Put your PRIVATE_KEY in contract/.env first."
    );
  }

  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 ETH on this network - fund it from a faucet before deploying."
    );
  }

  console.log("\nDeploying TemiToken...");
  const token = await ethers.deployContract("TemiToken");
  await token.waitForDeployment();

  const address = await token.getAddress();
  const deployTx = token.deploymentTransaction();

  // Wait for a few confirmations so Etherscan has indexed the code before we
  // try to verify it.
  if (deployTx && network.name !== "hardhat") {
    console.log(`Tx hash: ${deployTx.hash}`);
    console.log("Waiting for 5 confirmations...");
    await deployTx.wait(5);
  }

  console.log("\n=== Deployed ===");
  console.log(`Address:      ${address}`);
  console.log(`Name:         ${await token.name()}`);
  console.log(`Symbol:       ${await token.symbol()}`);
  console.log(`Decimals:     ${await token.decimals()}`);
  console.log(
    `Total supply: ${ethers.formatUnits(await token.totalSupply(), 18)}`
  );
  console.log(
    `Deployer holds: ${ethers.formatUnits(
      await token.balanceOf(deployer.address),
      18
    )}`
  );
  console.log(`\nVerify with:\n  npx hardhat verify --network ${network.name} ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
