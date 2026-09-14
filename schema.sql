-- D1 SQLite schema for Share Note Cloudflare Worker
CREATE TABLE IF NOT EXISTS users (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL UNIQUE,
    created INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    users_id INTEGER NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    created INTEGER NOT NULL DEFAULT (unixepoch()),
    validated INTEGER DEFAULT NULL,
    revoked INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    users_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    filetype TEXT NOT NULL,
    bytes INTEGER DEFAULT NULL,
    encrypted INTEGER DEFAULT 0,
    hash TEXT DEFAULT NULL,
    created INTEGER NOT NULL DEFAULT (unixepoch()),
    updated INTEGER NOT NULL DEFAULT (unixepoch()),
    expires INTEGER DEFAULT NULL,
    accessed INTEGER DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_apikeys_key ON api_keys (api_key);
CREATE INDEX IF NOT EXISTS idx_apikeys_user ON api_keys (users_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_files_name_type ON files (filename, filetype);
CREATE INDEX IF NOT EXISTS idx_files_user ON files (users_id);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files (hash);
CREATE INDEX IF NOT EXISTS idx_files_accessed ON files (accessed);
