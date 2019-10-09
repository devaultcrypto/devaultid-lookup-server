/* Store blocks */
CREATE TABLE IF NOT EXISTS blocks
(
	block_height INTEGER NOT NULL,
	block_hash BLOB NOT NULL,
	PRIMARY KEY (block_height),
	CHECK (block_height >= 83750)
);

/* Index blocks by block hash and block height separately. */
CREATE UNIQUE INDEX IF NOT EXISTS index_block_hash ON blocks (block_hash);

/* Insert the activation block as an anchor. */
INSERT OR IGNORE INTO blocks (block_hash, block_height) 
VALUES (X'000000000000009aae550fdfb26c68eb0e638f16dab01132b3af5e5b622b563f', 83750);

/* Keep track of the best chaintip a chain of blocks is part of */
CREATE TABLE IF NOT EXISTS block_chain
(
	block_height INTEGER NOT NULL,
	chain_parent INTEGER NULL,
	chain_tip INTEGER NOT NULL,
	PRIMARY KEY (block_height),
	FOREIGN KEY (block_height) REFERENCES blocks (block_height) ON DELETE CASCADE ON UPDATE RESTRICT,
	FOREIGN KEY (chain_parent) REFERENCES blocks (block_height) ON DELETE CASCADE ON UPDATE RESTRICT,
	FOREIGN KEY (chain_tip) REFERENCES blocks (block_height) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Index block_chain by parent and tip separately. */
CREATE INDEX IF NOT EXISTS index_chain_parent ON block_chain (chain_parent);
CREATE INDEX IF NOT EXISTS index_chain_tip ON block_chain (chain_tip);

/* Store transactions */
CREATE TABLE IF NOT EXISTS transactions
(
	transaction_id INTEGER NOT NULL,
	transaction_hash BLOB NOT NULL,
	transaction_body BLOB NULL,
	transaction_proof BLOB NULL,
	PRIMARY KEY (transaction_id),
	UNIQUE (transaction_hash)
);

/* Link transactions to blocks. */
CREATE TABLE IF NOT EXISTS block_transactions
(
	block_height INTEGER NOT NULL,
	transaction_id INTEGER NOT NULL,
	PRIMARY KEY (block_height, transaction_id),
	FOREIGN KEY (block_height) REFERENCES blocks (block_height) ON DELETE CASCADE ON UPDATE RESTRICT
	FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Store account names separately to avoid duplication. */
CREATE TABLE IF NOT EXISTS names
(
	name_id INTEGER NOT NULL,
	name_text TEXT NOT NULL,
	PRIMARY KEY (name_id),
	UNIQUE (name_text COLLATE BINARY)
);

/* Store cash accounts. */
CREATE TABLE IF NOT EXISTS accounts
(
	account_id INTEGER NOT NULL,
	account_number INTEGER NOT NULL,
	account_emoji TEXT NOT NULL,
	account_hash TEXT NOT NULL,
	account_collision_count INTEGER NOT NULL DEFAULT 0,
	account_collision_length INTEGER NOT NULL DEFAULT 0,
	name_id INTEGER NOT NULL,
	transaction_id INTEGER NOT NULL,
	PRIMARY KEY (account_id),
	UNIQUE (transaction_id),
	FOREIGN KEY (name_id) REFERENCES names (name_id) ON DELETE RESTRICT ON UPDATE RESTRICT
	FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Store the current chain tip and prevent deletion of active data. */
CREATE TABLE IF NOT EXISTS service_status
(
	chain_root INTEGER NOT NULL,
	chain_tip INTEGER NOT NULL,
	PRIMARY KEY (chain_root),
	FOREIGN KEY (chain_root) REFERENCES blocks (block_height) ON DELETE RESTRICT ON UPDATE RESTRICT,
	FOREIGN KEY (chain_tip) REFERENCES blocks (block_height) ON DELETE RESTRICT ON UPDATE RESTRICT,
	CHECK (chain_root == 83750)
);

/* Insert the chain root to prevent unwanted deletion of active chain data. */
INSERT OR IGNORE INTO service_status (chain_tip, chain_root)
VALUES (83750, 83750);

/* Store payloads separately to avoid duplication */
CREATE TABLE IF NOT EXISTS payloads
(
	payload_id INTEGER NOT NULL,
	payload_type INTEGER NOT NULL,
	payload_data BLOB NOT NULL,
	payload_address TEXT NULL,
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

CREATE TABLE IF NOT EXISTS error_types
(
	error_type_id INTEGER NOT NULL,
	error_description TEXT NOT NULL,
	PRIMARY KEY (error_type_id)
);

CREATE TABLE IF NOT EXISTS registration_errors
(
	transaction_id INTEGER NOT NULL,
	error_type_id INTEGER NOT NULL,
	PRIMARY KEY (transaction_id),
	FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id)
	FOREIGN KEY (error_type_id) REFERENCES error_types (error_type_id)
);

INSERT OR IGNORE INTO error_types VALUES 
(1, 'Invalid account name'),
(2, 'Missing payload data'),
(3, 'Invalid payload length');
