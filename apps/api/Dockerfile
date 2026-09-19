# Multi-stage build for apps/api (Rust api + worker binaries).
# Migrations stay on the Node/Drizzle image from apps/api-ts.

FROM rust:1.98-bookworm AS builder
WORKDIR /app
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --bin api --bin worker

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libssl3 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/api /usr/local/bin/api
COPY --from=builder /app/target/release/worker /usr/local/bin/worker
EXPOSE 3000
CMD ["api"]

# Same release binaries for local compose; override command to `worker` for the worker service.
FROM runtime AS development
