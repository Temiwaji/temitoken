const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const NAME = "TemiToken";
const SYMBOL = "TMT";
const DECIMALS = 18n;
const SUPPLY = ethers.parseUnits("1000000000", 18); // 1,000,000,000 TMT

async function deployFixture() {
  const [deployer, alice, bob] = await ethers.getSigners();
  const token = await ethers.deployContract("TemiToken");
  await token.waitForDeployment();
  return { token, deployer, alice, bob };
}

describe("TemiToken", function () {
  describe("metadata", function () {
    it("has the right name", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal(NAME);
    });

    it("has the right symbol", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.symbol()).to.equal(SYMBOL);
    });

    it("uses 18 decimals", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.decimals()).to.equal(DECIMALS);
    });
  });

  describe("supply", function () {
    it("mints exactly 1,000,000,000 tokens", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.totalSupply()).to.equal(SUPPLY);
    });

    it("gives the entire supply to the deployer", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      expect(await token.balanceOf(deployer.address)).to.equal(SUPPLY);
    });

    it("leaves every other account empty", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      expect(await token.balanceOf(alice.address)).to.equal(0n);
    });
  });

  describe("transfer", function () {
    it("moves tokens between accounts", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("250", 18);

      await expect(token.transfer(alice.address, amount)).to.changeTokenBalances(
        token,
        [deployer, alice],
        [-amount, amount]
      );
    });

    it("emits a Transfer event", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("1", 18);

      await expect(token.transfer(alice.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(deployer.address, alice.address, amount);
    });

    it("reverts when the sender has an insufficient balance", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("1", 18);

      // Alice holds nothing, so this must revert and not silently succeed.
      await expect(token.connect(alice).transfer(bob.address, amount))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(alice.address, 0n, amount);
    });

    it("reverts when sending to the zero address", async function () {
      const { token } = await loadFixture(deployFixture);

      await expect(
        token.transfer(ethers.ZeroAddress, ethers.parseUnits("1", 18))
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });

    it("does not change the total supply", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      await token.transfer(alice.address, ethers.parseUnits("500", 18));
      expect(await token.totalSupply()).to.equal(SUPPLY);
    });
  });

  describe("approve and transferFrom", function () {
    it("records an allowance", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 18);

      await expect(token.approve(alice.address, amount))
        .to.emit(token, "Approval")
        .withArgs(deployer.address, alice.address, amount);

      expect(await token.allowance(deployer.address, alice.address)).to.equal(amount);
    });

    it("lets the spender move the approved tokens and spends the allowance", async function () {
      const { token, deployer, alice, bob } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 18);

      await token.approve(alice.address, amount);

      await expect(
        token.connect(alice).transferFrom(deployer.address, bob.address, amount)
      ).to.changeTokenBalances(token, [deployer, bob], [-amount, amount]);

      expect(await token.allowance(deployer.address, alice.address)).to.equal(0n);
    });

    it("reverts when the spender exceeds the allowance", async function () {
      const { token, deployer, alice, bob } = await loadFixture(deployFixture);
      const allowed = ethers.parseUnits("100", 18);
      const tooMuch = ethers.parseUnits("101", 18);

      await token.approve(alice.address, allowed);

      await expect(
        token.connect(alice).transferFrom(deployer.address, bob.address, tooMuch)
      )
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance")
        .withArgs(alice.address, allowed, tooMuch);
    });

    it("reverts when there is no allowance at all", async function () {
      const { token, deployer, alice, bob } = await loadFixture(deployFixture);

      await expect(
        token
          .connect(alice)
          .transferFrom(deployer.address, bob.address, ethers.parseUnits("1", 18))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });

  describe("no privileged functions", function () {
    // The whole promise of this token is that nobody can inflate it or freeze
    // it, so assert the ABI simply does not contain the dangerous entry points.
    const forbidden = [
      "mint",
      "burn",
      "owner",
      "transferOwnership",
      "renounceOwnership",
      "pause",
      "unpause",
      "blacklist",
    ];

    it("exposes no mint, owner, pause or blacklist function", async function () {
      const { token } = await loadFixture(deployFixture);
      const names = token.interface.fragments
        .filter((fragment) => fragment.type === "function")
        .map((fragment) => fragment.name);

      for (const name of forbidden) {
        expect(names, `${name}() must not exist`).to.not.include(name);
      }
    });

    it("exposes only the standard ERC20 surface", async function () {
      const { token } = await loadFixture(deployFixture);
      const names = token.interface.fragments
        .filter((fragment) => fragment.type === "function")
        .map((fragment) => fragment.name)
        .sort();

      expect(names).to.deep.equal([
        "INITIAL_SUPPLY",
        "allowance",
        "approve",
        "balanceOf",
        "decimals",
        "name",
        "symbol",
        "totalSupply",
        "transfer",
        "transferFrom",
      ]);
    });
  });
});
