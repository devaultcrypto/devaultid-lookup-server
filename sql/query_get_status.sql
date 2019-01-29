SELECT
	block_height AS 'index_height',
	HEX(block_hash) AS 'index_chaintip'
FROM service_status 
LEFT JOIN blocks ON (service_status.chain_tip = blocks.block_height)
