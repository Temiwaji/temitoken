// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ClassSpinnerStaking
/// @notice Gates the classroom spinner's "raise hand" action behind a TMT
///         stake. The teacher (contract owner) opens a question round with a
///         stake/reward/penalty, students stake to raise their hand, the
///         teacher spins client-side and resolves the selected student as
///         correct (stake + reward paid) or wrong (penalty kept, remainder
///         refunded, student removed so the teacher can spin again). Anyone
///         left un-selected when a round closes self-refunds in full.
/// @dev TemiToken itself is immutable and ownerless, so all of this logic
///      lives here instead - TemiToken is only ever read via IERC20.
contract ClassSpinnerStaking is Ownable, ReentrancyGuard {
    IERC20 public immutable token;
    uint256 public immutable studentCount;

    enum RoundState {
        Inactive,
        Open,
        Locked,
        Closed
    }

    enum HandStatus {
        None,
        Raised,
        Wrong,
        Correct,
        Refunded
    }

    struct Round {
        RoundState state;
        uint128 stakeAmount;
        uint128 rewardAmount;
        uint128 penaltyAmount;
        uint64 openedAt;
    }

    uint256 public currentRoundId;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => uint256[]) private _pool;
    mapping(uint256 => mapping(uint256 => uint256)) private _poolIndex; // studentId => index+1
    mapping(uint256 => mapping(uint256 => HandStatus)) public handStatus;

    mapping(uint256 => address) public studentWallet;
    mapping(address => uint256) public studentIdOf;

    /// @notice Sum of every stake currently at risk (Raised, not yet resolved
    ///         or refunded). withdrawSurplus can never dip below this, so the
    ///         teacher can never withdraw funds still owed to a student.
    uint256 public reservedBalance;

    error InvalidStudentId();
    error IdentityAlreadyClaimed(uint256 studentId);
    error WalletAlreadyBound(address wallet);
    error NotYourIdentity();
    error RoundAlreadyActive();
    error RoundNotOpen();
    error RoundNotLocked();
    error StakeAmountZero();
    error PenaltyExceedsStake();
    error InsufficientContractBalance(uint256 required, uint256 available);
    error EmptyPool();
    error StakeAlreadyRaised();
    error NotInPool();
    error RoundNotClosed();
    error NothingToRefund();
    error SurplusExceedsAvailable(uint256 requested, uint256 available);

    event IdentityClaimed(uint256 indexed studentId, address indexed wallet);
    event RoundOpened(
        uint256 indexed roundId,
        uint128 stakeAmount,
        uint128 rewardAmount,
        uint128 penaltyAmount
    );
    event HandRaised(uint256 indexed roundId, uint256 indexed studentId);
    event HandLowered(uint256 indexed roundId, uint256 indexed studentId);
    event PoolLocked(uint256 indexed roundId, uint256 poolSize);
    event StudentResolved(
        uint256 indexed roundId,
        uint256 indexed studentId,
        bool correct,
        uint256 payout
    );
    event RoundClosed(uint256 indexed roundId, uint256 winningStudentId);
    event RefundClaimed(uint256 indexed roundId, uint256 indexed studentId, uint256 amount);
    event RoundCancelled(uint256 indexed roundId);
    event RewardsFunded(address indexed from, uint256 amount);
    event SurplusWithdrawn(address indexed to, uint256 amount);

    constructor(
        address tokenAddress,
        address teacher,
        uint256 studentCount_
    ) Ownable(teacher) {
        token = IERC20(tokenAddress);
        studentCount = studentCount_;
    }

    // ---------------------------------------------------------------------
    // Identity - self-service, permanent
    // ---------------------------------------------------------------------

    function claimIdentity(uint256 studentId) external {
        if (studentId == 0 || studentId > studentCount) revert InvalidStudentId();
        if (studentWallet[studentId] != address(0)) revert IdentityAlreadyClaimed(studentId);
        if (studentIdOf[msg.sender] != 0) revert WalletAlreadyBound(msg.sender);

        studentWallet[studentId] = msg.sender;
        studentIdOf[msg.sender] = studentId;

        emit IdentityClaimed(studentId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Round lifecycle - teacher only
    // ---------------------------------------------------------------------

    function openRound(
        uint128 stakeAmount,
        uint128 rewardAmount,
        uint128 penaltyAmount
    ) external onlyOwner {
        Round storage current = rounds[currentRoundId];
        if (
            currentRoundId != 0 &&
            (current.state == RoundState.Open || current.state == RoundState.Locked)
        ) {
            revert RoundAlreadyActive();
        }
        if (stakeAmount == 0) revert StakeAmountZero();
        if (penaltyAmount > stakeAmount) revert PenaltyExceedsStake();

        uint256 available = freeBalance();
        if (available < rewardAmount) {
            revert InsufficientContractBalance(rewardAmount, available);
        }

        currentRoundId += 1;
        rounds[currentRoundId] = Round({
            state: RoundState.Open,
            stakeAmount: stakeAmount,
            rewardAmount: rewardAmount,
            penaltyAmount: penaltyAmount,
            openedAt: uint64(block.timestamp)
        });

        emit RoundOpened(currentRoundId, stakeAmount, rewardAmount, penaltyAmount);
    }

    function lockPool() external onlyOwner {
        Round storage round = rounds[currentRoundId];
        if (round.state != RoundState.Open) revert RoundNotOpen();
        if (_pool[currentRoundId].length == 0) revert EmptyPool();

        round.state = RoundState.Locked;
        emit PoolLocked(currentRoundId, _pool[currentRoundId].length);
    }

    function resolveSelected(uint256 studentId, bool correct) external onlyOwner nonReentrant {
        uint256 roundId = currentRoundId;
        Round storage round = rounds[roundId];
        if (round.state != RoundState.Locked) revert RoundNotLocked();
        if (handStatus[roundId][studentId] != HandStatus.Raised) revert NotInPool();

        _removeFromPool(roundId, studentId);
        reservedBalance -= round.stakeAmount;

        address wallet = studentWallet[studentId];
        uint256 payout;

        if (correct) {
            handStatus[roundId][studentId] = HandStatus.Correct;
            payout = uint256(round.stakeAmount) + uint256(round.rewardAmount);

            uint256 balance = token.balanceOf(address(this));
            if (balance < payout) revert InsufficientContractBalance(payout, balance);

            round.state = RoundState.Closed;
            emit StudentResolved(roundId, studentId, true, payout);
            emit RoundClosed(roundId, studentId);

            _safeTransfer(wallet, payout);
        } else {
            handStatus[roundId][studentId] = HandStatus.Wrong;
            payout = uint256(round.stakeAmount) - uint256(round.penaltyAmount);

            bool poolEmpty = _pool[roundId].length == 0;
            if (poolEmpty) {
                round.state = RoundState.Closed;
            }

            emit StudentResolved(roundId, studentId, false, payout);
            if (poolEmpty) emit RoundClosed(roundId, 0);

            if (payout > 0) _safeTransfer(wallet, payout);
        }
    }

    function cancelRound() external onlyOwner {
        Round storage round = rounds[currentRoundId];
        if (round.state != RoundState.Open && round.state != RoundState.Locked) {
            revert RoundNotOpen();
        }

        round.state = RoundState.Closed;
        emit RoundCancelled(currentRoundId);
    }

    // ---------------------------------------------------------------------
    // Student actions
    // ---------------------------------------------------------------------

    function raiseHand() external nonReentrant {
        uint256 studentId = studentIdOf[msg.sender];
        if (studentId == 0) revert InvalidStudentId();

        uint256 roundId = currentRoundId;
        Round storage round = rounds[roundId];
        if (round.state != RoundState.Open) revert RoundNotOpen();
        if (handStatus[roundId][studentId] != HandStatus.None) revert StakeAlreadyRaised();

        handStatus[roundId][studentId] = HandStatus.Raised;
        _poolIndex[roundId][studentId] = _pool[roundId].length + 1;
        _pool[roundId].push(studentId);
        reservedBalance += round.stakeAmount;

        emit HandRaised(roundId, studentId);

        bool ok = token.transferFrom(msg.sender, address(this), round.stakeAmount);
        require(ok, "transferFrom failed");
    }

    function lowerHand() external nonReentrant {
        uint256 studentId = studentIdOf[msg.sender];
        if (studentId == 0) revert InvalidStudentId();

        uint256 roundId = currentRoundId;
        Round storage round = rounds[roundId];
        if (round.state != RoundState.Open) revert RoundNotOpen();
        if (handStatus[roundId][studentId] != HandStatus.Raised) revert NotInPool();

        _removeFromPool(roundId, studentId);
        handStatus[roundId][studentId] = HandStatus.None;
        reservedBalance -= round.stakeAmount;

        emit HandLowered(roundId, studentId);

        _safeTransfer(msg.sender, round.stakeAmount);
    }

    function withdrawRefund(uint256 roundId) external nonReentrant {
        uint256 studentId = studentIdOf[msg.sender];
        if (studentId == 0) revert InvalidStudentId();

        Round storage round = rounds[roundId];
        if (round.state != RoundState.Closed) revert RoundNotClosed();
        if (handStatus[roundId][studentId] != HandStatus.Raised) revert NothingToRefund();

        handStatus[roundId][studentId] = HandStatus.Refunded;
        reservedBalance -= round.stakeAmount;

        emit RefundClaimed(roundId, studentId, round.stakeAmount);

        _safeTransfer(msg.sender, round.stakeAmount);
    }

    // ---------------------------------------------------------------------
    // Funding / treasury
    // ---------------------------------------------------------------------

    function fundRewards(uint256 amount) external nonReentrant {
        emit RewardsFunded(msg.sender, amount);
        bool ok = token.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");
    }

    function withdrawSurplus(uint256 amount, address to) external onlyOwner nonReentrant {
        uint256 available = freeBalance();
        if (amount > available) revert SurplusExceedsAvailable(amount, available);

        emit SurplusWithdrawn(to, amount);
        _safeTransfer(to, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getPool(uint256 roundId) external view returns (uint256[] memory) {
        return _pool[roundId];
    }

    function poolSize(uint256 roundId) external view returns (uint256) {
        return _pool[roundId].length;
    }

    function currentRound() external view returns (Round memory) {
        return rounds[currentRoundId];
    }

    function freeBalance() public view returns (uint256) {
        return token.balanceOf(address(this)) - reservedBalance;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _removeFromPool(uint256 roundId, uint256 studentId) private {
        uint256[] storage pool = _pool[roundId];
        uint256 idxPlusOne = _poolIndex[roundId][studentId];
        uint256 lastIndex = pool.length - 1;
        uint256 idx = idxPlusOne - 1;

        if (idx != lastIndex) {
            uint256 lastStudentId = pool[lastIndex];
            pool[idx] = lastStudentId;
            _poolIndex[roundId][lastStudentId] = idx + 1;
        }

        pool.pop();
        delete _poolIndex[roundId][studentId];
    }

    function _safeTransfer(address to, uint256 amount) private {
        bool ok = token.transfer(to, amount);
        require(ok, "transfer failed");
    }
}
