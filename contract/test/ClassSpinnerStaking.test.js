const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const STUDENT_COUNT = 14;
const STAKE = ethers.parseUnits("10", 18);
const REWARD = ethers.parseUnits("5", 18);
const PENALTY = ethers.parseUnits("4", 18);
const FUNDING = ethers.parseUnits("1000", 18);
const STUDENT_ALLOWANCE = ethers.parseUnits("1000", 18);

// The only fixture ever passed to loadFixture(). Every other bit of setup
// (opening a round, raising hands, locking) is a plain helper called directly
// inside each test, on top of this one cached snapshot - mixing multiple
// distinct fixture functions through loadFixture() caused Hardhat's
// snapshot stack to leak state between unrelated tests.
async function deployFixture() {
  const [teacher, alice, bob, carol, dave, outsider] = await ethers.getSigners();

  const token = await ethers.deployContract("TemiToken");
  await token.waitForDeployment();

  const staking = await ethers.deployContract("ClassSpinnerStaking", [
    await token.getAddress(),
    teacher.address,
    STUDENT_COUNT,
  ]);
  await staking.waitForDeployment();

  // Give every named student some TMT and a standing approval, mirroring how
  // the dapp's TransferForm/StakeButton would prompt for approve() once.
  for (const s of [alice, bob, carol, dave]) {
    await token.transfer(s.address, ethers.parseUnits("500", 18));
    await token.connect(s).approve(await staking.getAddress(), STUDENT_ALLOWANCE);
  }
  await token.approve(await staking.getAddress(), STUDENT_ALLOWANCE); // teacher, for fundRewards

  return { token, staking, teacher, alice, bob, carol, dave, outsider };
}

async function claim(staking, signer, studentId) {
  await staking.connect(signer).claimIdentity(studentId);
}

/** Funds the pool and opens round 1 with the default stake/reward/penalty. */
async function openRound(ctx) {
  await ctx.staking.connect(ctx.teacher).fundRewards(FUNDING);
  await ctx.staking.connect(ctx.teacher).openRound(STAKE, REWARD, PENALTY);
}

/** Claims identities 1/2/3 for alice/bob/carol, raises all three hands, locks. */
async function lockedRoundWithThree(ctx) {
  await openRound(ctx);
  await claim(ctx.staking, ctx.alice, 1);
  await claim(ctx.staking, ctx.bob, 2);
  await claim(ctx.staking, ctx.carol, 3);
  await ctx.staking.connect(ctx.alice).raiseHand();
  await ctx.staking.connect(ctx.bob).raiseHand();
  await ctx.staking.connect(ctx.carol).raiseHand();
  await ctx.staking.connect(ctx.teacher).lockPool();
}

describe("ClassSpinnerStaking", function () {
  describe("deployment", function () {
    it("stores the token, teacher/owner, and student count", async function () {
      const { staking, token, teacher } = await loadFixture(deployFixture);
      expect(await staking.token()).to.equal(await token.getAddress());
      expect(await staking.owner()).to.equal(teacher.address);
      expect(await staking.studentCount()).to.equal(STUDENT_COUNT);
      expect(await staking.currentRoundId()).to.equal(0n);
    });
  });

  describe("identity", function () {
    it("claims an identity and binds both directions", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await expect(staking.connect(alice).claimIdentity(1))
        .to.emit(staking, "IdentityClaimed")
        .withArgs(1, alice.address);

      expect(await staking.studentWallet(1)).to.equal(alice.address);
      expect(await staking.studentIdOf(alice.address)).to.equal(1n);
    });

    it("reverts for studentId 0 or beyond studentCount", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await expect(staking.connect(alice).claimIdentity(0)).to.be.revertedWithCustomError(
        staking,
        "InvalidStudentId"
      );
      await expect(
        staking.connect(alice).claimIdentity(STUDENT_COUNT + 1)
      ).to.be.revertedWithCustomError(staking, "InvalidStudentId");
    });

    it("reverts claiming an id someone else already claimed", async function () {
      const { staking, alice, bob } = await loadFixture(deployFixture);
      await claim(staking, alice, 1);
      await expect(staking.connect(bob).claimIdentity(1))
        .to.be.revertedWithCustomError(staking, "IdentityAlreadyClaimed")
        .withArgs(1);
    });

    it("reverts a wallet claiming a second identity", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await claim(staking, alice, 1);
      await expect(staking.connect(alice).claimIdentity(2))
        .to.be.revertedWithCustomError(staking, "WalletAlreadyBound")
        .withArgs(alice.address);
    });

    it("reverts double-claiming the same id from the same wallet", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await claim(staking, alice, 1);
      await expect(staking.connect(alice).claimIdentity(1)).to.be.revertedWithCustomError(
        staking,
        "IdentityAlreadyClaimed"
      );
    });
  });

  describe("openRound", function () {
    it("reverts for non-owner", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await expect(staking.connect(alice).openRound(STAKE, REWARD, PENALTY)).to.be.reverted;
    });

    it("reverts on a zero stake amount", async function () {
      const { staking, teacher } = await loadFixture(deployFixture);
      await expect(
        staking.connect(teacher).openRound(0, REWARD, PENALTY)
      ).to.be.revertedWithCustomError(staking, "StakeAmountZero");
    });

    it("reverts when the penalty exceeds the stake", async function () {
      const { staking, teacher } = await loadFixture(deployFixture);
      await expect(
        staking.connect(teacher).openRound(STAKE, REWARD, STAKE + 1n)
      ).to.be.revertedWithCustomError(staking, "PenaltyExceedsStake");
    });

    it("reverts when the contract cannot yet cover the reward", async function () {
      const { staking, teacher } = await loadFixture(deployFixture);
      // No fundRewards() call yet, so freeBalance() is 0.
      await expect(staking.connect(teacher).openRound(STAKE, REWARD, PENALTY))
        .to.be.revertedWithCustomError(staking, "InsufficientContractBalance")
        .withArgs(REWARD, 0n);
    });

    it("opens a round once funded, and blocks opening a second while active", async function () {
      const { staking, teacher } = await loadFixture(deployFixture);
      await staking.connect(teacher).fundRewards(FUNDING);

      await expect(staking.connect(teacher).openRound(STAKE, REWARD, PENALTY))
        .to.emit(staking, "RoundOpened")
        .withArgs(1, STAKE, REWARD, PENALTY);
      expect(await staking.currentRoundId()).to.equal(1n);

      await expect(
        staking.connect(teacher).openRound(STAKE, REWARD, PENALTY)
      ).to.be.revertedWithCustomError(staking, "RoundAlreadyActive");
    });
  });

  describe("raiseHand / lowerHand", function () {
    it("reverts raising a hand without a claimed identity", async function () {
      const ctx = await loadFixture(deployFixture);
      await openRound(ctx);
      await expect(ctx.staking.connect(ctx.alice).raiseHand()).to.be.revertedWithCustomError(
        ctx.staking,
        "InvalidStudentId"
      );
    });

    it("reverts raising a hand when no round is open", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await claim(staking, alice, 1);
      await expect(staking.connect(alice).raiseHand()).to.be.revertedWithCustomError(
        staking,
        "RoundNotOpen"
      );
    });

    it("pulls the stake and records the hand as raised", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);

      await expect(staking.connect(alice).raiseHand()).to.changeTokenBalances(
        token,
        [alice, staking],
        [-STAKE, STAKE]
      );

      expect(await staking.handStatus(1, 1)).to.equal(1n); // HandStatus.Raised
      expect(await staking.getPool(1)).to.deep.equal([1n]);
      expect(await staking.reservedBalance()).to.equal(STAKE);
    });

    it("reverts raising the same hand twice in one round", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await staking.connect(alice).raiseHand();
      await expect(staking.connect(alice).raiseHand()).to.be.revertedWithCustomError(
        staking,
        "StakeAlreadyRaised"
      );
    });

    it("bubbles the ERC20 allowance error when the student never approved", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await token.connect(alice).approve(await staking.getAddress(), 0);

      await expect(staking.connect(alice).raiseHand()).to.be.revertedWithCustomError(
        token,
        "ERC20InsufficientAllowance"
      );
    });

    it("lowerHand refunds in full and clears the pool entry", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await staking.connect(alice).raiseHand();

      await expect(staking.connect(alice).lowerHand()).to.changeTokenBalances(
        token,
        [alice, staking],
        [STAKE, -STAKE]
      );
      expect(await staking.getPool(1)).to.deep.equal([]);
      expect(await staking.reservedBalance()).to.equal(0n);
    });

    it("reverts lowerHand when the student never raised", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await expect(staking.connect(alice).lowerHand()).to.be.revertedWithCustomError(
        staking,
        "NotInPool"
      );
    });
  });

  describe("lockPool", function () {
    it("reverts on an empty pool", async function () {
      const ctx = await loadFixture(deployFixture);
      await openRound(ctx);
      await expect(ctx.staking.connect(ctx.teacher).lockPool()).to.be.revertedWithCustomError(
        ctx.staking,
        "EmptyPool"
      );
    });

    it("locks a non-empty pool and reverts locking twice", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, teacher, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await staking.connect(alice).raiseHand();

      await expect(staking.connect(teacher).lockPool())
        .to.emit(staking, "PoolLocked")
        .withArgs(1, 1);

      await expect(staking.connect(teacher).lockPool()).to.be.revertedWithCustomError(
        staking,
        "RoundNotOpen"
      );
    });
  });

  describe("resolveSelected", function () {
    it("pays stake + reward on correct and closes the round", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, teacher, alice } = ctx;
      await lockedRoundWithThree(ctx);
      const payout = STAKE + REWARD;

      const tx = staking.connect(teacher).resolveSelected(1, true);
      await expect(tx).to.changeTokenBalances(token, [staking, alice], [-payout, payout]);
      await expect(tx)
        .to.emit(staking, "StudentResolved")
        .withArgs(1, 1, true, payout)
        .and.to.emit(staking, "RoundClosed")
        .withArgs(1, 1);

      expect(await staking.handStatus(1, 1)).to.equal(3n); // HandStatus.Correct
      const round = await staking.currentRound();
      expect(round.state).to.equal(3n); // RoundState.Closed
    });

    it("reverts resolving after the round already closed", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, teacher } = ctx;
      await lockedRoundWithThree(ctx);
      await staking.connect(teacher).resolveSelected(1, true);
      await expect(
        staking.connect(teacher).resolveSelected(2, true)
      ).to.be.revertedWithCustomError(staking, "RoundNotLocked");
    });

    it("reverts resolving a student not currently in the pool", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, teacher } = ctx;
      await lockedRoundWithThree(ctx);
      await expect(
        staking.connect(teacher).resolveSelected(4, true)
      ).to.be.revertedWithCustomError(staking, "NotInPool");
    });

    it("refunds stake minus penalty on wrong, keeps the round locked when others remain", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, teacher, alice } = ctx;
      await lockedRoundWithThree(ctx);
      const refund = STAKE - PENALTY;

      const tx = staking.connect(teacher).resolveSelected(1, false);
      await expect(tx).to.changeTokenBalances(token, [staking, alice], [-refund, refund]);
      await expect(tx)
        .to.emit(staking, "StudentResolved")
        .withArgs(1, 1, false, refund);

      expect(await staking.handStatus(1, 1)).to.equal(2n); // HandStatus.Wrong
      expect(await staking.poolSize(1)).to.equal(2n);
      const round = await staking.currentRound();
      expect(round.state).to.equal(2n); // RoundState.Locked, still open for another spin
    });

    it("auto-closes the round when the last pooled student is marked wrong", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, teacher } = ctx;
      await lockedRoundWithThree(ctx);
      await staking.connect(teacher).resolveSelected(1, false);
      await staking.connect(teacher).resolveSelected(2, false);

      await expect(staking.connect(teacher).resolveSelected(3, false))
        .to.emit(staking, "RoundClosed")
        .withArgs(1, 0);

      const round = await staking.currentRound();
      expect(round.state).to.equal(3n); // Closed
    });

    it("golden path: wrong, wrong, correct settles every balance correctly", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, alice, bob, carol, teacher } = ctx;
      await lockedRoundWithThree(ctx);

      const contractAddr = await staking.getAddress();
      const startContract = await token.balanceOf(contractAddr);

      await staking.connect(teacher).resolveSelected(1, false); // alice wrong
      await staking.connect(teacher).resolveSelected(2, false); // bob wrong
      await staking.connect(teacher).resolveSelected(3, true); // carol correct

      const refund = STAKE - PENALTY;
      const correctPayout = STAKE + REWARD;

      // alice and bob each staked STAKE, got back (STAKE - PENALTY).
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseUnits("500", 18) - PENALTY
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseUnits("500", 18) - PENALTY
      );
      // carol staked STAKE, got back STAKE + REWARD.
      expect(await token.balanceOf(carol.address)).to.equal(
        ethers.parseUnits("500", 18) + REWARD
      );

      // startContract was captured after the three stakes were already pulled in,
      // so the only remaining movement is the three payouts going back out.
      const expectedContractDelta = -(refund + refund + correctPayout);
      expect(await token.balanceOf(contractAddr)).to.equal(startContract + expectedContractDelta);
      expect(await staking.reservedBalance()).to.equal(0n);
    });
  });

  describe("unselected refunds", function () {
    it("lets students left in the pool self-refund once the round closes", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, teacher, bob, carol } = ctx;
      await lockedRoundWithThree(ctx);

      await staking.connect(teacher).resolveSelected(1, true); // alice correct, round closes

      await expect(staking.connect(bob).withdrawRefund(1)).to.changeTokenBalances(
        token,
        [bob, staking],
        [STAKE, -STAKE]
      );
      await expect(staking.connect(carol).withdrawRefund(1))
        .to.emit(staking, "RefundClaimed")
        .withArgs(1, 3, STAKE);

      expect(await staking.reservedBalance()).to.equal(0n);
    });

    it("reverts a double withdrawal", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, teacher, alice, bob } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await claim(staking, bob, 2);
      await staking.connect(alice).raiseHand();
      await staking.connect(bob).raiseHand();
      await staking.connect(teacher).lockPool();
      await staking.connect(teacher).resolveSelected(1, true);

      await staking.connect(bob).withdrawRefund(1);
      await expect(staking.connect(bob).withdrawRefund(1)).to.be.revertedWithCustomError(
        staking,
        "NothingToRefund"
      );
    });

    it("reverts withdrawing before the round is closed", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await staking.connect(alice).raiseHand();

      await expect(staking.connect(alice).withdrawRefund(1)).to.be.revertedWithCustomError(
        staking,
        "RoundNotClosed"
      );
    });

    it("reverts a student who never staked that round", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, teacher, alice, dave } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await claim(staking, dave, 4);
      await staking.connect(alice).raiseHand();
      await staking.connect(teacher).lockPool();
      await staking.connect(teacher).resolveSelected(1, true);

      await expect(staking.connect(dave).withdrawRefund(1)).to.be.revertedWithCustomError(
        staking,
        "NothingToRefund"
      );
    });
  });

  describe("cancelRound", function () {
    it("cancels an Open round and lets stakers self-refund", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, teacher, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await staking.connect(alice).raiseHand();

      await expect(staking.connect(teacher).cancelRound())
        .to.emit(staking, "RoundCancelled")
        .withArgs(1);

      await expect(staking.connect(alice).withdrawRefund(1)).to.changeTokenBalances(
        token,
        [alice, staking],
        [STAKE, -STAKE]
      );
    });

    it("cancels a Locked round and lets stakers self-refund", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, teacher, alice, bob } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await claim(staking, bob, 2);
      await staking.connect(alice).raiseHand();
      await staking.connect(bob).raiseHand();
      await staking.connect(teacher).lockPool();

      await staking.connect(teacher).cancelRound();

      await expect(staking.connect(alice).withdrawRefund(1)).to.changeTokenBalances(
        token,
        [alice, staking],
        [STAKE, -STAKE]
      );
      await expect(staking.connect(bob).withdrawRefund(1)).to.changeTokenBalances(
        token,
        [bob, staking],
        [STAKE, -STAKE]
      );
    });

    it("reverts cancelling when there is no active round", async function () {
      const { staking, teacher } = await loadFixture(deployFixture);
      await expect(staking.connect(teacher).cancelRound()).to.be.revertedWithCustomError(
        staking,
        "RoundNotOpen"
      );
    });
  });

  describe("fundRewards", function () {
    it("is permissionless and increases free balance", async function () {
      const { staking, token, alice } = await loadFixture(deployFixture);

      await expect(staking.connect(alice).fundRewards(ethers.parseUnits("100", 18)))
        .to.emit(staking, "RewardsFunded")
        .withArgs(alice.address, ethers.parseUnits("100", 18));

      expect(await staking.freeBalance()).to.equal(ethers.parseUnits("100", 18));
      expect(await token.balanceOf(await staking.getAddress())).to.equal(
        ethers.parseUnits("100", 18)
      );
    });
  });

  describe("withdrawSurplus - no-rug guarantee", function () {
    it("caps withdrawal at balance minus reservedBalance while a round is active", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, token, teacher, alice } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await staking.connect(alice).raiseHand();

      // Alice's stake is a separate transfer on top of FUNDING, and it is
      // immediately reserved, so it cancels itself out of freeBalance.
      const available = FUNDING;
      expect(await staking.freeBalance()).to.equal(available);

      await expect(
        staking.connect(teacher).withdrawSurplus(available + 1n, teacher.address)
      )
        .to.be.revertedWithCustomError(staking, "SurplusExceedsAvailable")
        .withArgs(available + 1n, available);

      await expect(
        staking.connect(teacher).withdrawSurplus(available, teacher.address)
      ).to.changeTokenBalances(token, [staking, teacher], [-available, available]);
    });

    it("still respects unclaimed refunds after a round closes", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, teacher, alice, bob } = ctx;
      await openRound(ctx);
      await claim(staking, alice, 1);
      await claim(staking, bob, 2);
      await staking.connect(alice).raiseHand();
      await staking.connect(bob).raiseHand();
      await staking.connect(teacher).lockPool();
      await staking.connect(teacher).resolveSelected(1, true); // closes round; bob still owed STAKE

      const available = await staking.freeBalance();
      expect(await staking.reservedBalance()).to.equal(STAKE); // bob's unclaimed refund

      await expect(
        staking.connect(teacher).withdrawSurplus(available + 1n, teacher.address)
      ).to.be.revertedWithCustomError(staking, "SurplusExceedsAvailable");
    });

    it("reverts for non-owner", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await expect(staking.connect(alice).withdrawSurplus(1, alice.address)).to.be.reverted;
    });
  });

  describe("access control surface", function () {
    it("blocks every owner-only function for a non-owner", async function () {
      const ctx = await loadFixture(deployFixture);
      const { staking, alice } = ctx;
      await lockedRoundWithThree(ctx);

      await expect(staking.connect(alice).openRound(STAKE, REWARD, PENALTY))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
      await expect(staking.connect(alice).resolveSelected(1, true))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
      await expect(staking.connect(alice).cancelRound())
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
      await expect(staking.connect(alice).withdrawSurplus(1, alice.address))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
    });
  });

  describe("ABI surface", function () {
    it("exposes exactly the expected function set", async function () {
      const { staking } = await loadFixture(deployFixture);
      const names = staking.interface.fragments
        .filter((f) => f.type === "function")
        .map((f) => f.name)
        .sort();

      expect(names).to.deep.equal(
        [
          "cancelRound",
          "claimIdentity",
          "currentRound",
          "currentRoundId",
          "freeBalance",
          "fundRewards",
          "getPool",
          "handStatus",
          "lockPool",
          "lowerHand",
          "openRound",
          "owner",
          "poolSize",
          "raiseHand",
          "renounceOwnership",
          "reservedBalance",
          "resolveSelected",
          "rounds",
          "studentCount",
          "studentIdOf",
          "studentWallet",
          "token",
          "transferOwnership",
          "withdrawRefund",
          "withdrawSurplus",
        ].sort()
      );
    });
  });
});
