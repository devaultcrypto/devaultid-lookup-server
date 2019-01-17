/* Store blocks */
CREATE TABLE IF NOT EXISTS blocks
(
	block_hash BLOB NOT NULL,
	block_height INTEGER NOT NULL,
	PRIMARY KEY (block_hash),
	CHECK (block_height >= 563719)
);

/* Keep track of the best chaintip a chain of blocks is part of */
CREATE TABLE IF NOT EXISTS block_chain
(
	block_hash BLOB NOT NULL,
	chain_parent BLOB NULL,
	chain_tip BLOB NOT NULL,
	PRIMARY KEY (block_hash),
	FOREIGN KEY (block_hash) REFERENCES blocks (block_hash) ON DELETE CASCADE ON UPDATE RESTRICT,
	FOREIGN KEY (chain_parent) REFERENCES blocks (block_hash) ON DELETE CASCADE ON UPDATE RESTRICT,
	FOREIGN KEY (chain_tip) REFERENCES blocks (block_hash) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Store transactions. */
CREATE TABLE IF NOT EXISTS block_transactions
(
	transaction_hash BLOB NOT NULL,
	block_hash BLOB NOT NULL,
	PRIMARY KEY (transaction_hash, block_hash),
	FOREIGN KEY (block_hash) REFERENCES blocks (block_hash) ON DELETE CASCADE ON UPDATE RESTRICT
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
	account_number INTEGER NULL,
	transaction_hash BLOB NOT NULL,
	PRIMARY KEY (account_id),
	FOREIGN KEY (account_name_id) REFERENCES account_names (account_name_id) ON DELETE RESTRICT ON UPDATE RESTRICT
	FOREIGN KEY (transaction_hash) REFERENCES transactions (transaction_hash) ON DELETE CASCADE ON UPDATE RESTRICT
);

/* Store the current chain tip and prevent deletion of active data. */
CREATE TABLE IF NOT EXISTS service_status
(
	chain_root BLOB NOT NULL,
	chain_tip BLOB NOT NULL,
	PRIMARY KEY (chain_root),
	FOREIGN KEY (chain_root) REFERENCES blocks (block_hash) ON DELETE RESTRICT ON UPDATE RESTRICT,
	FOREIGN KEY (chain_tip) REFERENCES blocks (block_hash) ON DELETE RESTRICT ON UPDATE RESTRICT,
	CHECK (chain_root == X'000000000000000000b0a674cb090cfc1b465848e5fe01794ad69cb683ef9548')
);

/* Insert the activation block as an anchor. */
INSERT OR IGNORE INTO blocks (block_hash, block_height) 
VALUES (X'000000000000000000b0a674cb090cfc1b465848e5fe01794ad69cb683ef9548', 563719);

/* Insert the chain root to prevent unwanted deletion of active chain data. */
INSERT OR IGNORE INTO service_status (chain_tip, chain_root)
VALUES (X'000000000000000000b0a674cb090cfc1b465848e5fe01794ad69cb683ef9548', X'000000000000000000b0a674cb090cfc1b465848e5fe01794ad69cb683ef9548');
