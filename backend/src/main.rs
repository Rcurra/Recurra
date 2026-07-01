mod api;
mod config;
mod errors;
mod models;
mod openfort;
mod scheduler;

use axum::Router;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::Config::from_env();

    // Spawn the scheduler as a background task
    tokio::spawn(scheduler::run(cfg.clone()));

    let app = Router::new().nest("/api", api::router());

    let addr = format!("0.0.0.0:{}", cfg.port);
    tracing::info!("listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
