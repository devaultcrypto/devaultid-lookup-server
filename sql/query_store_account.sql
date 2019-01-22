INSERT OR IGNORE INTO accounts (name_id, account_number, account_emoji, account_hash, account_collision_count, account_collision_length, transaction_id) 
VALUES (:nameId, :number, :emoji, :collisionHash, :collisionCount, :collisionLength, :transactionId)
