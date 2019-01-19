/* Store blocks */
CREATE TABLE IF NOT EXISTS blocks
(
	block_id INTEGER NOT NULL,
	block_hash BLOB NOT NULL,
	block_height INTEGER NOT NULL,
	PRIMARY KEY (block_id),
	CHECK (block_height >= 563719)
);

/* Index blocks by block hash and block height separately. */
CREATE UNIQUE INDEX IF NOT EXISTS index_block_hash ON blocks (block_hash);
CREATE INDEX IF NOT EXISTS index_block_height ON blocks (block_height);

/* Keep track of the best chaintip a chain of blocks is part of */
CREATE TABLE IF NOT EXISTS block_chain
(
	block_id INTEGER NOT NULL,
	chain_parent INTEGER NULL,
	chain_tip INTEGER NOT NULL,
	PRIMARY KEY (block_id),
	FOREIGN KEY (block_id) REFERENCES blocks (block_id) ON DELETE CASCADE ON UPDATE RESTRICT,
	FOREIGN KEY (chain_parent) REFERENCES blocks (block_id) ON DELETE CASCADE ON UPDATE RESTRICT,
	FOREIGN KEY (chain_tip) REFERENCES blocks (block_id) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Index block_chain by parent and tip separately. */
CREATE INDEX IF NOT EXISTS index_chain_parent ON block_chain (chain_parent);
CREATE INDEX IF NOT EXISTS index_chain_tip ON block_chain (chain_tip);

/* Store transactions */
CREATE TABLE IF NOT EXISTS transactions
(
	transaction_id INTEGER NOT NULL,
	transaction_hash BLOB NOT NULL,
	PRIMARY KEY (transaction_id),
	UNIQUE (transaction_hash)
);

/* Index transactions by their hash */
CREATE UNIQUE INDEX IF NOT EXISTS index_transaction ON transactions (transaction_id);

/* Store transaction specific data. */
CREATE TABLE IF NOT EXISTS transaction_data
(
	transaction_id INTEGER NOT NULL,
	transaction_data BLOB NOT NULL,
	inclusion_proof BLOB NOT NULL,
	PRIMARY KEY (transaction_id),
	FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Link transactions to blocks. */
CREATE TABLE IF NOT EXISTS block_transactions
(
	block_id INTEGER NOT NULL,
	transaction_id INTEGER NOT NULL,
	PRIMARY KEY (block_id, transaction_id),
	FOREIGN KEY (block_id) REFERENCES blocks (block_id) ON DELETE CASCADE ON UPDATE RESTRICT
	FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Store account names separately to avoid duplication. */
CREATE TABLE IF NOT EXISTS account_names
(
	account_name_id INTEGER NOT NULL,
	account_name_text TEXT NOT NULL,
	PRIMARY KEY (account_name_id),
	UNIQUE (account_name_text COLLATE BINARY)
);

/* Store cash accounts. */
CREATE TABLE IF NOT EXISTS accounts
(
	account_id INTEGER NOT NULL,
	account_name_id INTEGER NOT NULL,
	account_number INTEGER NOT NULL,
	transaction_id INTEGER NOT NULL,
	PRIMARY KEY (account_id),
	UNIQUE (transaction_id),
	FOREIGN KEY (account_name_id) REFERENCES account_names (account_name_id) ON DELETE RESTRICT ON UPDATE RESTRICT
	FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Insert the activation block as an anchor. */
INSERT OR IGNORE INTO blocks (block_hash, block_height) 
VALUES (X'000000000000000000b0a674cb090cfc1b465848e5fe01794ad69cb683ef9548', 563719);

/* Store the current chain tip and prevent deletion of active data. */
CREATE TABLE IF NOT EXISTS service_status
(
	chain_root INTEGER NOT NULL,
	chain_tip INTEGER NOT NULL,
	PRIMARY KEY (chain_root),
	FOREIGN KEY (chain_root) REFERENCES blocks (block_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
	FOREIGN KEY (chain_tip) REFERENCES blocks (block_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
	CHECK (chain_root == 1)
);

/* Insert the chain root to prevent unwanted deletion of active chain data. */
INSERT OR IGNORE INTO service_status (chain_tip, chain_root)
VALUES (1, 1);

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

CREATE TABLE IF NOT EXISTS registration_error_types
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
	FOREIGN KEY (error_type_id) REFERENCES registration_error_types (error_type_id)
);

INSERT OR IGNORE INTO registration_error_types VALUES 
(1, 'Invalid account name'),
(2, 'Missing payload data'),
(3, 'Empty payload data'),
(4, 'Invalid payload length');
