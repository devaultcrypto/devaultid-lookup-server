/* Store payloads separately to avoid duplication */
CREATE TABLE IF NOT EXISTS payloads
(
	payload_id INTEGER NOT NULL,
	payload_type INTEGER NOT NULL,
	payload_data BLOB NOT NULL,
	PRIMARY KEY (payload_id),
	UNIQUE (payload_type, payload_data)
);

/* Link payloads to cash accounts */
CREATE TABLE IF NOT EXISTS account_payloads
(
	account_id INTEGER NOT NULL,
	payload_id INTEGER NOT NULL,
	PRIMARY KEY (account_id, payload_id),
	FOREIGN KEY (account_id) REFERENCES accounts (account_id) ON DELETE CASCADE,
	FOREIGN KEY (payload_id) REFERENCES payloads (payload_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

/* Store metadata about cash accounts. */
CREATE TABLE IF NOT EXISTS account_metadata
(
	account_id INTEGER NOT NULL,
	account_hash TEXT NOT NULL,
	account_emoji TEXT NOT NULL,
	account_collision_count INTEGER NOT NULL DEFAULT 0,
	account_collision_length INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (account_id),
	FOREIGN KEY (account_id) REFERENCES accounts (account_id) ON DELETE CASCADE ON UPDATE RESTRICT
);
