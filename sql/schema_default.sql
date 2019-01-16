CREATE TABLE IF NOT EXISTS transaction_data
(
	transaction_hash BLOB NOT NULL,
	transaction_data BLOB NOT NULL,
	transaction_proof BLOB NOT NULL,
	PRIMARY KEY (transaction_hash),
	FOREIGN KEY (transaction_hash) REFERENCES transactions (transaction_hash) ON DELETE CASCADE ON UPDATE RESTRICT
);

