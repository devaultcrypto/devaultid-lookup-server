INSERT OR IGNORE INTO accounts (name_id, account_number, account_emoji, account_hash, account_collision_count, account_collision_length, transaction_id) 
VALUES ((SELECT name_id FROM names WHERE name_text = :name), :number, :emoji, :collisionHash, :collisionCount, :collisionLength, (SELECT transaction_id FROM transactions WHERE transaction_hash = :transactionHash))
