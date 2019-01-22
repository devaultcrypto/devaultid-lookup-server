/* Updates the "chain tip" of all blocks that share the given ancestor, including itself. */
UPDATE block_chain
SET chain_tip = :chain_tip
WHERE block_height IN
(
	WITH RECURSIVE part_of_chain(chain_parent) AS
	(
		SELECT block_height
		FROM block_chain
		WHERE block_height = :chain_tip

		UNION ALL

		SELECT block_chain.chain_parent
		FROM block_chain, part_of_chain
		WHERE block_chain.block_height = part_of_chain.chain_parent
	)
	SELECT block_height FROM block_chain
	WHERE block_chain.block_height IN part_of_chain
);
