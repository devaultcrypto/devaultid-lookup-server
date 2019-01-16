/* Store blocks */
CREATE TABLE IF NOT EXISTS blocks
(
	block_hash BLOB NOT NULL,
	block_height INTEGER NOT NULL,
	PRIMARY KEY (block_hash),
	CHECK (block_height >= 563720)
);

/* Keep track of the best chaintip a chain of blocks is part of */
CREATE TABLE IF NOT EXISTS block_chain
(
	block_hash BLOB NOT NULL,
	block_chain BLOB NOT NULL,
	PRIMARY KEY (block_hash),
	FOREIGN KEY (block_hash) REFERENCES blocks (block_hash) ON DELETE CASCADE ON UPDATE RESTRICT,
	FOREIGN KEY (block_chain) REFERENCES blocks (block_hash) ON DELETE RESTRICT ON UPDATE RESTRICT
);

/* Store transactions. */
CREATE TABLE IF NOT EXISTS transactions
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
	transaction_id BLOB NOT NULL,
	PRIMARY KEY (account_id),
	FOREIGN KEY (account_name_id) REFERENCES account_names (account_name_id) ON DELETE RESTRICT ON UPDATE RESTRICT
	FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id) ON DELETE CASCADE ON UPDATE RESTRICT
);
