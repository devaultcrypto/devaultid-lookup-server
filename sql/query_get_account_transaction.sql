SELECT 
	hex(transactions.transaction_data) AS 'transaction',
	hex(transaction_proof) AS 'inclusion_proof'
FROM
	transactions 
WHERE
	transactions.transaction_hash = :transaction_hash
