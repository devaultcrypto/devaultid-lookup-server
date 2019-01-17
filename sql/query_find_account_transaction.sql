SELECT
	accounts.transaction_hash
FROM
	accounts
LEFT JOIN
	account_names USING (account_name_id)

WHERE
	account_number = :account_number AND 
	account_names.account_name_text = :account_name
