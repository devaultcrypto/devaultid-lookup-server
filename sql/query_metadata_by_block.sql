SELECT *

FROM accounts 
LEFT JOIN account_names USING (account_name_id) 
LEFT JOIN account_metadata USING (account_id) 
LEFT JOIN account_payloads USING (account_id) 
LEFT JOIN payloads USING (payload_id) 

WHERE account_number = :account_number
