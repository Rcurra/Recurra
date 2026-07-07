// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ExecutorWired} from "./ExecutorWired.sol";

// Stores subscription plans and tracks when each subscriber's next payment is due.
// ExecutorWired supplies the one-time setExecutor wiring + onlyExecutor gate (markPaid).
contract SubscriptionRegistry is ExecutorWired {
    struct Plan {
        address merchant;
        address token;      // ERC-20 token accepted for payment
        uint256 amount;     // amount per interval, in token's smallest unit
        uint256 interval;   // seconds between payments
        bool active;
    }

    struct Subscription {
        uint256 planId;
        address subscriber;
        uint256 nextPaymentDue; // unix timestamp
        bool active;
    }

    // IDs start at 1 so 0 always means "doesn't exist"
    uint256 public nextPlanId = 1;
    uint256 public nextSubId = 1;

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Subscription) public subscriptions;
    // subscriber → list of their subscription IDs
    mapping(address => uint256[]) public subscriberSubs;
    // subscriber → planId → true while subscribed (blocks double-subscribing)
    mapping(address => mapping(uint256 => bool)) public hasActiveSubscription;

    event PlanCreated(uint256 indexed planId, address indexed merchant);
    event PlanDeactivated(uint256 indexed planId);
    event Subscribed(uint256 indexed subId, address indexed subscriber, uint256 indexed planId);
    event Unsubscribed(uint256 indexed subId);
    event PaymentRecorded(uint256 indexed subId, uint256 nextPaymentDue);

    error InvalidPlanParams(); // zero token / amount / interval
    error PlanNotActive(); // plan nonexistent or already deactivated
    error AlreadySubscribed(); // double-subscribe to same plan
    error NotPlanMerchant(); // deactivatePlan by anyone but the plan's merchant
    error NotSubscriber(); // unsubscribe by anyone but the subscription's owner
    error SubscriptionNotActive(); // acting on a nonexistent or cancelled subscription

    /// Merchant entry point. Whoever calls this becomes the plan's merchant —
    /// there's no merchant registration step; the plan IS the registration.
    /// Example: createPlan(USDC, 10e6, 30 days) = "10 USDC every 30 days, paid to me".
    function createPlan(address token, uint256 amount, uint256 interval) external returns (uint256 planId) {
        // Reject broken plans up front: a zero token/amount/interval plan could
        // never be paid (or would be chargeable every block). The 10-year cap
        // keeps markPaid's `nextPaymentDue + interval` from ever overflowing —
        // an absurd interval would brick the sub with checked-math reverts
        // while isDue keeps reporting it as due (scheduler retry loop).
        if (token == address(0) || amount == 0 || interval == 0 || interval > 3650 days) {
            revert InvalidPlanParams();
        }

        // Grab the next free ID, then bump the counter for the plan after this one.
        // unchecked: a uint256 id counter can't realistically overflow.
        unchecked {
            planId = nextPlanId++;
        }

        // msg.sender is baked in as the merchant — later, PaymentExecutor reads
        // amount/token/merchant from THIS struct, never from backend calldata.
        // That's what makes the plan the on-chain source of truth.
        plans[planId] = Plan({merchant: msg.sender, token: token, amount: amount, interval: interval, active: true});

        emit PlanCreated(planId, msg.sender);
    }

    /// Merchant kill switch for their own plan. New subscriptions become
    /// impossible (subscribe checks plan.active) and the PaymentExecutor will
    /// refuse charges for existing subs — but those subs survive on-chain, so
    /// subscribers keep their history and can unsubscribe + withdraw normally.
    function deactivatePlan(uint256 planId) external {
        Plan storage plan = plans[planId];

        // Active-check first: a nonexistent plan has merchant == address(0),
        // so checking the merchant first would throw a misleading
        // NotPlanMerchant at whoever probes a bad id. Also makes
        // double-deactivation an explicit revert, not a silent no-op.
        if (!plan.active) revert PlanNotActive();
        if (msg.sender != plan.merchant) revert NotPlanMerchant();

        plan.active = false;

        emit PlanDeactivated(planId);
    }

    /// Subscriber entry point. Called by the user's (7702 smart) account from the
    /// frontend during onboarding. Creates the schedule — moves no money.
    function subscribe(uint256 planId) external returns (uint256 subId) {
        Plan storage plan = plans[planId];

        // One check covers two cases: a nonexistent plan has active == false
        // (default struct value), and a merchant-deactivated plan is also false.
        if (!plan.active) revert PlanNotActive();

        // Without this, a double-click on the subscribe button = two live
        // subscriptions = double-charged every interval.
        if (hasActiveSubscription[msg.sender][planId]) revert AlreadySubscribed();

        // unchecked: same reasoning as the plan id counter.
        unchecked {
            subId = nextSubId++;
        }

        // nextPaymentDue = now → the FIRST charge is due immediately, so the
        // scheduler picks it up on its next tick. The merchant gets paid at the
        // start of each cycle (pay-then-use, like Netflix), not at the end.
        subscriptions[subId] =
            Subscription({planId: planId, subscriber: msg.sender, nextPaymentDue: block.timestamp, active: true});

        hasActiveSubscription[msg.sender][planId] = true;

        // Append-only history: cancelled subs stay in this list so the frontend
        // dashboard can show past subscriptions too.
        subscriberSubs[msg.sender].push(subId);

        emit Subscribed(subId, msg.sender, planId);
    }

    /// Subscriber cancel, anytime, no merchant approval. Stops future charges
    /// (Executor checks sub.active); escrow stays withdrawable in the Vault.
    /// Moves no money — the Registry never touches tokens.
    function unsubscribe(uint256 subId) external {
        Subscription storage sub = subscriptions[subId];

        // State first, authority second — same reasoning as deactivatePlan:
        // a nonexistent sub has subscriber == address(0).
        if (!sub.active) revert SubscriptionNotActive();
        if (msg.sender != sub.subscriber) revert NotSubscriber();

        sub.active = false;
        // Reopen the door: they can subscribe to this plan again later.
        // The old sub stays in subscriberSubs as history (append-only).
        hasActiveSubscription[msg.sender][sub.planId] = false;

        emit Unsubscribed(subId);
    }

    /// Called by the PaymentExecutor (and no one else) right before it moves
    /// money, to advance the schedule. Records no amounts — the Registry
    /// never touches tokens; it only answers "when is the next one due?".
    ///
    /// Due-date math (invariant #2 — at most one charge per due date, missed
    /// cycles forgiven, never batch-collected):
    ///   - on time / slightly late: nextPaymentDue += interval. Anchored to
    ///     the original schedule, so scheduler lag never drifts the cycle.
    ///   - a full interval (or more) behind: nextPaymentDue = now + interval.
    ///     Re-anchor from today; the skipped cycles are simply gone. Advancing
    ///     by += here would leave nextPaymentDue in the past and let charges
    ///     fire back-to-back until it caught up — batch collection, forbidden.
    ///
    /// Deliberately no "too early" check: NotDue lives in the Executor (per
    /// the frozen catalog), and markPaid is Executor-only anyway.
    function markPaid(uint256 subId) external onlyExecutor {
        Subscription storage sub = subscriptions[subId];
        if (!sub.active) revert SubscriptionNotActive();

        uint256 interval = plans[sub.planId].interval;
        uint256 due = sub.nextPaymentDue;

        if (block.timestamp >= due + interval) {
            sub.nextPaymentDue = block.timestamp + interval;
        } else {
            sub.nextPaymentDue = due + interval;
        }

        emit PaymentRecorded(subId, sub.nextPaymentDue);
    }

    /// The scheduler's question, answered on-chain so due-ness logic lives in
    /// exactly one place. False for nonexistent ids (both actives default false),
    /// cancelled subs, deactivated plans, and not-yet-due schedules. Never
    /// reverts — the scheduler filters with it, it doesn't act on it.
    function isDue(uint256 subId) external view returns (bool) {
        Subscription storage sub = subscriptions[subId];
        return sub.active && plans[sub.planId].active && block.timestamp >= sub.nextPaymentDue;
    }

    /// Full id list in one call (cancelled subs included — it's history).
    /// The subscriberSubs auto-getter only serves one index at a time and
    /// exposes no length, so the backend couldn't enumerate without this.
    function getSubscriberSubs(address subscriber) external view returns (uint256[] memory) {
        return subscriberSubs[subscriber];
    }
}
