INSERT OR IGNORE INTO registration_errors (transaction_id, error_type_id) 
VALUES (:transactionId, :errorTypeId)
