SELECT
	HEX(block_hash) AS 'block_hash',
	HEX(transaction_hash) AS 'transaction_hash',
	HEX(transaction_body) AS 'transaction',
	HEX(transaction_proof) AS 'inclusion_proof'

FROM accounts 
LEFT JOIN names USING (name_id)
LEFT JOIN transactions USING (transaction_id)
LEFT JOIN block_transactions USING (transaction_id)
LEFT JOIN blocks USING (block_height)

WHERE UPPER(name_text) = UPPER(:accountName)
AND account_number = :accountNumber
AND account_hash LIKE (:accountHash || '%')
