CREATE TABLE IF NOT EXISTS transactions
(
	transaction_hash BLOB NOT NULL,
	transaction_data BLOB NOT NULL,
	transaction_proof BLOB NOT NULL,
	PRIMARY KEY (transaction_hash),
	FOREIGN KEY (transaction_hash) REFERENCES block_transactions (transaction_hash) ON DELETE CASCADE ON UPDATE RESTRICT
);

