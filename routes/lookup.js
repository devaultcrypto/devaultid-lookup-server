const express = require('express');
const router = express.Router();

// Read the configuration file.
const config = require("../config.js");

// Enable support for sqlite databases.
const Database = require('better-sqlite3');

// Open the database in read-write mode.
const sql = new Database(config.storage.filename, { memory: false, readonly: true });

//
const query = sql.prepare("SELECT HEX(transaction_data) AS 'transaction', HEX(inclusion_proof) AS 'inclusion_proof' FROM accounts LEFT JOIN account_names USING (account_name_id) LEFT JOIN transaction_data USING (transaction_id) WHERE UPPER(account_name_text) = UPPER(:account_name) AND account_number = :account_number");

router.get('/:accountNumber/:accountName', async function (req, res)
{
	let result = query.all({ account_number: req.params['accountNumber'], account_name: req.params['accountName'] });

	return res.status(200).json({ error: '', name: req.params['accountName'], block: parseInt(req.params['accountNumber']) + 563620, results: result});
});

module.exports = router;
