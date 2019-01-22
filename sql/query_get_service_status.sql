SELECT * 
FROM service_status 
LEFT JOIN blocks ON (chain_tip = block_height)
