/* Updates the "chain tip" of all blocks that share the given ancestor, including itself. */
UPDATE block_chain
SET chain_tip = :chain_tip
WHERE block_id IN
(
	WITH RECURSIVE part_of_chain(chain_parent) AS
	(
		SELECT block_id
		FROM block_chain
		WHERE block_id = :chain_tip

		UNION ALL

		SELECT block_chain.chain_parent
		FROM block_chain, part_of_chain
		WHERE block_chain.block_id = part_of_chain.chain_parent
	)
	SELECT block_id FROM block_chain
	WHERE block_chain.block_id IN part_of_chain
);


 
