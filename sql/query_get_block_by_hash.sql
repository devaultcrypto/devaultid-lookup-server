SELECT * 
FROM blocks 
LEFT JOIN block_chain USING (block_height) 
WHERE block_hash = :blockHashHex
