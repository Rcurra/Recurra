//! Typed contract bindings, generated at compile time by alloy's `sol!` macro.
//!
//! We declare only the surface the backend actually touches, mirroring the
//! Solidity in `contracts/src/*.sol`. Public state variables in Solidity get
//! auto-generated getter functions, so `plans`, `subscriptions`,
//! `hasActiveSubscription`, `nextPlanId` and `nextSubId` are declared here as
//! `view` functions even though they are `public` fields on-chain.
//!
//! The backend is read-only against the registry (per the M0 freeze): every
//! registry write is user-authority and signed client-side via ZeroDev, so
//! `subscribe`/`unsubscribe`/`createPlan`/`markPaid` are deliberately NOT bound
//! here — the backend has no key to send them.
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

        // Full id list in one call (cancelled subs included — it's history), so
        // the dashboard filter enumerates a subscriber's subs without O(n)
        // walking every id. Replaces the length-less `subscriberSubs` getter.
        function getSubscriberSubs(address subscriber) external view returns (uint256[] memory);

        // hasActiveSubscription[subscriber][planId] -> bool.
        function hasActiveSubscription(address subscriber, uint256 planId) external view returns (bool);

        // Due-ness answered on-chain (single source of truth) — the scheduler
        // filters with this instead of comparing timestamps off-chain. False for
        // nonexistent ids, cancelled subs, deactivated plans and not-yet-due
        // schedules; never reverts.
        function isDue(uint256 subId) external view returns (bool);

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

// NOTE: PaymentExecutor is intentionally NOT bound yet. contracts/src/PaymentExecutor.sol
// is still a `TODO` stub carrying the pre-M0 shape (registerSessionKey / a 3-field
// PaymentExecuted). Once it's rewritten to the frozen interface
// (`executePayment(uint256 subId)`, the 5-field `PaymentExecuted` event, and the
// `NotAuthorized`/`NotDue`/`SubscriptionInactive`/`InsufficientVaultBalance` errors),
// bind that surface here — and only here — so the scheduler can encode calldata and
// triage the reverts. Binding it before then would diverge from the deployed contract.
