INSERT OR IGNORE INTO block_chain (block_height, chain_parent, chain_tip)
VALUES (:height, :parentHeight, :height)
