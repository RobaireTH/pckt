CREATE TABLE packet_secrets (
    out_point        TEXT PRIMARY KEY,
    owner_lock_hash  TEXT NOT NULL,
    sk_ciphertext    BLOB NOT NULL,
    sk_nonce         BLOB NOT NULL,
    created_at       INTEGER NOT NULL
);

CREATE INDEX packet_secrets_owner_idx ON packet_secrets(owner_lock_hash);

CREATE TABLE device_tokens (
    token_hash       TEXT NOT NULL,
    owner_lock_hash  TEXT NOT NULL,
    created_at       INTEGER NOT NULL,
    PRIMARY KEY (token_hash, owner_lock_hash)
);

CREATE INDEX device_tokens_owner_idx ON device_tokens(owner_lock_hash);
