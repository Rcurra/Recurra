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

// PaymentExecutor — the one contract the backend *writes* to. The scheduler
// encodes `executePayment(subId)` calldata and submits it; every other function
// here is `view`, used to simulate the charge before spending a real tx.
//
// This mirrors the frozen M0 interface now merged in contracts/src/PaymentExecutor.sol.
sol! {
    #[sol(rpc)]
    #[allow(missing_docs)]
    contract PaymentExecutor {
        // The only write the backend authors. Re-derives amount/token/recipient/
        // due-ness from chain state, so we send nothing but the subId.
        function executePayment(uint256 subId) external;

        // The single address allowed to call executePayment. Read so the scheduler
        // can simulate with the correct `from` — an eth_call defaults to the zero
        // address, which would always revert NotAuthorized and mask the real reason.
        function authorizedExecutor() external view returns (address);

        // --- events ---
        event PaymentExecuted(
            uint256 indexed subId,
            address indexed subscriber,
            address indexed merchant,
            address token,
            uint256 amount
        );

        // --- reverts the scheduler triages when a simulation fails ---
        error NotAuthorized();          // caller isn't authorizedExecutor
        error NotDue();                 // charged before nextPaymentDue (benign scheduler race)
        error SubscriptionInactive();   // cancelled sub OR deactivated plan
        error InsufficientVaultBalance();// escrow can't cover the plan amount
        error ZeroAddress();            // constructor/rotation wiring to 0
    }
}
