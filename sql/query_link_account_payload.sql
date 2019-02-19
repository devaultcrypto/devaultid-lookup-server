INSERT OR IGNORE INTO account_payloads (account_id, payload_id) VALUES
((SELECT account_id FROM accounts LEFT JOIN transactions USING (transaction_id) WHERE transaction_hash = :transactionHash), (SELECT payload_id FROM payloads WHERE payload_type = :type AND payload_data = :data))
