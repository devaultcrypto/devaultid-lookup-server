SELECT
	HEX(block_hash) AS 'block_hash',
	HEX(transaction_hash) AS 'transaction_hash',
	HEX(transaction_data) AS 'transaction',
	HEX(inclusion_proof) AS 'inclusion_proof'

FROM accounts 
LEFT JOIN transactions USING (transaction_id)
LEFT JOIN transaction_data USING (transaction_id)
LEFT JOIN block_transactions USING (transaction_id)
LEFT JOIN blocks USING (block_id)

WHERE account_number = :account_number
