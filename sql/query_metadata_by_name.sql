SELECT *

FROM accounts 
LEFT JOIN account_names USING (account_name_id) 
LEFT JOIN account_metadata USING (account_id) 
LEFT JOIN account_payloads USING (account_id) 
LEFT JOIN payloads USING (payload_id) 

WHERE UPPER(account_name_text) = UPPER(:account_name)
AND account_number = :account_number
