//! Typed contract bindings, generated at compile time by alloy's `sol!` macro.
//!
//! We declare only the surface the backend actually touches, mirroring the
//! Solidity in `contracts/src/*.sol`. Public state variables in Solidity get
//! auto-generated getter functions, so `plans`, `subscriptions`,
//! `subscriberSubs`, `hasActiveSubscription`, `nextPlanId` and `nextSubId` are
//! declared here as `view` functions even though they are `public` fields
//! on-chain.
//!
//! `#[sol(rpc)]` makes each `sol!` contract callable through an alloy
//! `Provider`: `SubscriptionRegistry::new(address, provider).nextSubId().call()`.

use alloy::sol;

sol! {
    #[sol(rpc)]
    #[allow(missing_docs)]
    contract SubscriptionRegistry {
        // --- auto-generated getters for public state ---
        function nextPlanId() external view returns (uint256);
        function nextSubId() external view returns (uint256);

        // plans[planId] -> Plan struct, returned as a flat tuple by the getter.
        function plans(uint256 planId)
            external
            view
            returns (address merchant, address token, uint256 amount, uint256 interval, bool active);

        // subscriptions[subId] -> Subscription struct, returned as a flat tuple.
        function subscriptions(uint256 subId)
            external
            view
            returns (uint256 planId, address subscriber, uint256 nextPaymentDue, bool active);

        // subscriberSubs[subscriber][index] -> one subId. NOTE: the auto-getter
        // exposes no array length, so this can't enumerate a subscriber's subs
        // on its own — we iterate all subs by id instead (see chain::mod).
        function subscriberSubs(address subscriber, uint256 index) external view returns (uint256);

        // hasActiveSubscription[subscriber][planId] -> bool.
        function hasActiveSubscription(address subscriber, uint256 planId) external view returns (bool);

        // --- writes that already exist on-chain (not yet called by the backend) ---
        function createPlan(address token, uint256 amount, uint256 interval) external returns (uint256 planId);
        function subscribe(uint256 planId) external returns (uint256 subId);

        // --- events ---
        event PlanCreated(uint256 indexed planId, address indexed merchant);
        event Subscribed(uint256 indexed subId, address indexed subscriber, uint256 indexed planId);
        event Unsubscribed(uint256 indexed subId);
        event PaymentRecorded(uint256 indexed subId, uint256 nextPaymentDue);
    }
}

sol! {
    #[sol(rpc)]
    #[allow(missing_docs)]
    contract SubscriptionVault {
        // subscriber -> token -> escrowed balance, used for dashboard/history display.
        function balances(address subscriber, address token) external view returns (uint256);

        event Deposited(address indexed subscriber, address indexed token, uint256 amount);
        event Debited(address indexed subscriber, address indexed token, uint256 amount, address recipient);
        event Withdrawn(address indexed subscriber, address indexed token, uint256 amount);
    }
}

// NOTE: PaymentExecutor.executePayment / registerSessionKey are intentionally
// NOT bound yet — they are still `TODO` in contracts/src/PaymentExecutor.sol.
// Add them here (and only here) once their final signatures land, so the
// scheduler's payment path and the `create` handler can encode calldata.
