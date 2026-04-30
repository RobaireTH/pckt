CREATE TABLE sender_profiles (
    owner_lock_hash  TEXT PRIMARY KEY,
    sender_address   TEXT NOT NULL,
    username         TEXT NOT NULL,
    updated_at       INTEGER NOT NULL
);
