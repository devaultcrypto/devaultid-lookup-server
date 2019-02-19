INSERT OR IGNORE INTO block_transactions (block_height, transaction_id) 
VALUES (:height, (SELECT transaction_id FROM transactions WHERE transaction_hash = :transactionHash))
