//! Library surface of the backend — exists so integration tests
//! (`tests/`) can drive the real modules against a live anvil chain; the
//! binary (`main.rs`) consumes exactly the same modules. No logic lives
//! here.

pub mod api;
pub mod chain;
pub mod config;
pub mod errors;
pub mod models;
pub mod openfort;
pub mod scheduler;
pub mod sender;
