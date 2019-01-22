SELECT
	account_id,
	name_text AS 'name',
	account_number AS 'number',
	account_emoji AS 'emoji',
	account_hash AS 'collision_hash',
	account_collision_count AS 'collision_count',
	account_collision_length AS 'collision_length',
	payloads.*

FROM accounts 
LEFT JOIN names USING (name_id) 
LEFT JOIN account_payloads USING (account_id) 
LEFT JOIN payloads USING (payload_id) 

WHERE UPPER(name_text) = UPPER(:accountName)
AND account_number = :accountNumber
AND account_hash LIKE (:accountHash || '%')
