CREATE TABLE messages (
    message_hash TEXT PRIMARY KEY,
    body         TEXT NOT NULL,
    created_at   INTEGER NOT NULL
);
