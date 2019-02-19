INSERT OR IGNORE INTO registration_errors (transaction_id, error_type_id) 
VALUES ((SELECT transaction_id FROM transactions WHERE transaction_hash = :transactionHash), :errorTypeId)
