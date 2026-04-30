FROM rust:1.93-slim-bookworm AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY backend backend
COPY contract contract
COPY shared shared

RUN cargo build --release -p pckt-backend

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/target/release/pckt-backend /usr/local/bin/pckt-backend
COPY backend/migrations /app/migrations

ENV PORT=8080
EXPOSE 8080
CMD ["/usr/local/bin/pckt-backend"]
