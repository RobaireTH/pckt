CREATE TABLE claim_badges (
    out_point          TEXT PRIMARY KEY,
    packet_out_point   TEXT NOT NULL,
    claim_tx_hash      TEXT NOT NULL,
    block_number       INTEGER NOT NULL,
    ts                 INTEGER NOT NULL,
    owner_lock_hash    TEXT NOT NULL,
    claimer_lock_hash  TEXT NOT NULL,
    claim_pubkey_hash  TEXT NOT NULL,
    scope_id           TEXT NOT NULL,
    slot_index         INTEGER NOT NULL,
    slot_amount        TEXT,
    metadata_json      TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_claim_badges_claim
    ON claim_badges(packet_out_point, claim_tx_hash, claimer_lock_hash);

CREATE INDEX idx_claim_badges_claimer ON claim_badges(claimer_lock_hash);
CREATE INDEX idx_claim_badges_packet  ON claim_badges(packet_out_point);
