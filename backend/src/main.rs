mod api;
mod chain;
mod config;
mod errors;
mod models;
mod openfort;
mod scheduler;
mod sender;

use axum::Router;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::Config::from_env();

    // Shared chain access (provider + registry address + Openfort client),
    // cloned into both the scheduler and the API router.
    let state = chain::AppState::new(cfg)
        .await
        .expect("failed to initialise chain state");

    // Spawn the scheduler as a background task.
    tokio::spawn(scheduler::run(state.clone()));

    let app = Router::new().nest("/api", api::router(state.clone()));

    let addr = format!("0.0.0.0:{}", state.cfg.port);
    tracing::info!("listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
