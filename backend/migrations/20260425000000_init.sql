CREATE TABLE packets (
    out_point          TEXT PRIMARY KEY,
    packet_type        INTEGER NOT NULL,
    slots_total        INTEGER NOT NULL,
    slots_claimed      INTEGER NOT NULL,
    initial_capacity   TEXT    NOT NULL,
    current_capacity   TEXT    NOT NULL,
    expiry             INTEGER NOT NULL,
    unlock_time        INTEGER NOT NULL,
    owner_lock_hash    TEXT    NOT NULL,
    claim_pubkey_hash  TEXT    NOT NULL,
    salt               BLOB    NOT NULL,
    message_hash       BLOB    NOT NULL,
    message_body       TEXT,
    sealed_at          INTEGER NOT NULL,
    last_seen_block    INTEGER NOT NULL
);

CREATE TABLE packet_events (
    id                 INTEGER PRIMARY KEY,
    out_point          TEXT NOT NULL,
    event_type         TEXT NOT NULL,
    tx_hash            TEXT NOT NULL,
    block_number       INTEGER NOT NULL,
    ts                 INTEGER NOT NULL,
    claimer_lock_hash  TEXT,
    slot_amount        TEXT
);

CREATE TABLE shortlinks (
    slug        TEXT PRIMARY KEY,
    full_url    TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER
);

CREATE INDEX idx_packets_owner   ON packets(owner_lock_hash);
CREATE INDEX idx_packets_pubkey  ON packets(claim_pubkey_hash);
CREATE INDEX idx_events_outpoint ON packet_events(out_point);
