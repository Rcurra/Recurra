// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Stores subscription plans and tracks when each subscriber's next payment is due.
contract SubscriptionRegistry {
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
    event Subscribed(uint256 indexed subId, address indexed subscriber, uint256 indexed planId);
    event Unsubscribed(uint256 indexed subId);
    event PaymentRecorded(uint256 indexed subId, uint256 nextPaymentDue);

    /// Merchant entry point. Whoever calls this becomes the plan's merchant —
    /// there's no merchant registration step; the plan IS the registration.
    /// Example: createPlan(USDC, 10e6, 30 days) = "10 USDC every 30 days, paid to me".
    function createPlan(address token, uint256 amount, uint256 interval) external returns (uint256 planId) {
        // Reject broken plans up front: a zero token/amount/interval plan could
        // never be paid (or would be chargeable every block).
        require(token != address(0), "token is zero address");
        require(amount > 0, "amount must be > 0");
        require(interval > 0, "interval must be > 0");

        // Grab the next free ID, then bump the counter for the plan after this one.
        planId = nextPlanId++;

        // msg.sender is baked in as the merchant — later, PaymentExecutor reads
        // amount/token/merchant from THIS struct, never from backend calldata.
        // That's what makes the plan the on-chain source of truth.
        plans[planId] = Plan({merchant: msg.sender, token: token, amount: amount, interval: interval, active: true});

        emit PlanCreated(planId, msg.sender);
    }

    /// Subscriber entry point. Called by the user's (7702 smart) account from the
    /// frontend during onboarding. Creates the schedule — moves no money.
    function subscribe(uint256 planId) external returns (uint256 subId) {
        Plan storage plan = plans[planId];

        // One check covers two cases: a nonexistent plan has active == false
        // (default struct value), and a merchant-deactivated plan is also false.
        require(plan.active, "plan not active");

        // Without this, a double-click on the subscribe button = two live
        // subscriptions = double-charged every interval.
        require(!hasActiveSubscription[msg.sender][planId], "already subscribed");

        subId = nextSubId++;

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

    // TODO: implement unsubscribe, recordPayment (markPaid), view helpers
}
