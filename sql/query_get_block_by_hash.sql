SELECT * FROM blocks LEFT JOIN block_chain USING (block_id) WHERE block_hash = :hash
