/* Updates the "chain tip" of all blocks that share the given ancestor, including itself. */
UPDATE block_chain
SET chain_tip = :block_hash
WHERE block_hash IN
(
	WITH RECURSIVE part_of_chain(chain_parent) AS
	(
		SELECT block_hash
		FROM block_chain
		WHERE block_hash = :block_hash

		UNION ALL

		SELECT block_chain.chain_parent
		FROM block_chain, part_of_chain
		WHERE block_chain.block_hash = part_of_chain.chain_parent
	)
	SELECT block_hash FROM block_chain
	WHERE block_chain.block_hash IN part_of_chain
);


 
