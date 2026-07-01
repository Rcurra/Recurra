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

    uint256 public nextPlanId;
    uint256 public nextSubId;

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Subscription) public subscriptions;
    // subscriber → list of their subscription IDs
    mapping(address => uint256[]) public subscriberSubs;

    event PlanCreated(uint256 indexed planId, address indexed merchant);
    event Subscribed(uint256 indexed subId, address indexed subscriber, uint256 indexed planId);
    event Unsubscribed(uint256 indexed subId);
    event PaymentRecorded(uint256 indexed subId, uint256 nextPaymentDue);

    // TODO: implement createPlan, subscribe, unsubscribe, recordPayment, getOverdueSubs
}
