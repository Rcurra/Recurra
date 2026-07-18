# Multi-stage build. Two things make this backend unlike a typical Rust
# service, both driving the shape below:
#
# 1. The scheduler is a persistent tokio loop, not a request handler --
#    this image is meant to run as a long-lived container (Fly.io Machine),
#    not a request-triggered serverless function.
# 2. openfort/mod.rs shells out to a vendored `@openfort/cli` install
#    (openfort-cli/) via tokio::process::Command, since re-deriving its
#    ES256 JWT + EIP-7702 signing in Rust wasn't worth the risk under
#    hackathon time pressure (see backend/plan.md's Track 4). That means
#    the runtime image needs Node.js present alongside the Rust binary,
#    not just the compiled binary alone.

# ---- Stage 1: the vendored Openfort CLI's real node_modules ----
FROM node:20-bookworm-slim AS openfort-cli-deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app/openfort-cli
COPY openfort-cli/package.json openfort-cli/pnpm-lock.yaml openfort-cli/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# ---- Stage 2: the Rust binary ----
# WORKDIR must be /app here, matching the runtime stage below --
# src/openfort/mod.rs resolves the CLI path via env!("CARGO_MANIFEST_DIR"),
# a COMPILE-time macro. Whatever path that bakes in has to be where
# openfort-cli/ actually lives at runtime, or the shell-out silently looks
# in the wrong place.
FROM rust:1-bookworm AS rust-build
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

# ---- Stage 3: runtime ----
# Node stays present here (not build-essential) -- the installed CLI is
# itself a Node script that has to actually execute, not just exist.
FROM node:20-bookworm-slim AS runtime
# The -slim base ships no CA bundle at all -- reqwest's TLS client refuses
# every HTTPS connection (Arbitrum RPC, Openfort's API) without it,
# failing with "No CA certificates were loaded from the system" the
# instant it tries to build a client, not at request time.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=rust-build /app/target/release/backend ./backend
COPY --from=openfort-cli-deps /app/openfort-cli ./openfort-cli
EXPOSE 3001
CMD ["./backend"]
