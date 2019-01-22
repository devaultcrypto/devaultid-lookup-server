// Enable support for configurable debugging.
const debug =
{
	lookup: require('debug')('calus:lookup'),
	object: require('debug')('calus:object'),
	errors: require('debug')('calus:errors'),
}

// Enable lookup messages by default.
debug.errors.enabled = true;

// Read the configuration file.
const config = require("../config.js");

// Enable RPC connections.
const bitcoinCashRPC = require('bitcoin-cash-rpc');

// Connect to the full node.
const rpc = new bitcoinCashRPC(config.node.address, config.node.user, config.node.pass, config.node.port, 5000);

// Enable support for filesystem operations.
const filesystem = require('fs');

// Enable support for sqlite databases.
const Database = require('better-sqlite3');

// Open the database in read-write mode.
const sql = new Database(config.storage.filename, { memory: false, readonly: true });

// Load the database queries.
const queries = 
{
	metadataByBlock: sql.prepare(filesystem.readFileSync('sql/query_metadata_by_block.sql', 'utf8').trim()),
	metadataByName: sql.prepare(filesystem.readFileSync('sql/query_metadata_by_name.sql', 'utf8').trim()),
	metadataByIdentifier: sql.prepare(filesystem.readFileSync('sql/query_metadata_by_identifier.sql', 'utf8').trim()),
};

// Define protocol constants.
const protocol = 
{
	blockModifier: 563620,
	payloadTypes:
	{
		1: { name: 'Key Hash', length: 20 },
		2: { name: 'Script Hash', length: 20 },
		3: { name: 'Payment Code', length: 80 },
		4: { name: 'Stealth Keys', length: 66 }
	},
}

// Enable support for Express apps.
const express = require('express');
const router = express.Router();

//
router.get('/:account_number/:account_name/:account_hash?', async function (req, res)
{
	//
	debug.lookup('Metadata requested for ' + req.params['account_name'] + '#' + req.params['account_number'] + (req.params['account_hash'] ? "." + req.params['account_hash'] : ""));

	try
	{
		let result = null;
		if(req.params['account_hash'])
		{
			// Query the database for the result.
			result = queries.metadataByIdentifier.all(req.params);
		}
		else
		{
			// Query the database for the result.
			result = queries.metadataByName.all(req.params);
		}

		// If no result could be found..
		if(typeof result == 'object' && Object.keys(result).length == 0)
		{
			// Return 404 eror.
			return res.status(404).json({ error: 'No account could be found with the requested parameters.' });
		}

		// Initialize and empty list of matched accounts and last identifier.
		let accounts = {};
		let account_id = null;
		let account_identifier = null;

		// If results were found, go over them and..
		for(resultIndex in result)
		{
			// Set the current account id.
			account_id = result[resultIndex].account_id;
			account_identifier = result[resultIndex].account_name_text + '#' + result[resultIndex].account_number + (result[resultIndex].account_collision_length > 0 ? '.' + result[resultIndex].account_hash.substring(0, result[resultIndex].account_collision_length) : '') + ';';

			// Parse account information.
			let account =
			{
				emoji: result[resultIndex].account_emoji,
				name: result[resultIndex].account_name_text,
				number: result[resultIndex].account_number,
				hash: result[resultIndex].account_hash,
				payment: [],
			}

			// Parse payment information.
			let paymentInformation =
			{
				type: protocol.payloadTypes[result[resultIndex].payload_type].name,
				address: result[resultIndex].payload_address,
			}

			// Assign the account to the list of accounts if needed.
			if(typeof accounts[account_id] == 'undefined')
			{
				accounts[account_id] = account;
			}

			// Add this payment information to the account.
			accounts[account_id].payment.push(paymentInformation);
		}

		// If more than one account was matched..
		if(Object.keys(accounts).length > 1)
		{
			// Return a 409 Conflict.
			return res.status(409).json({ error: 'More than one account matched with the requested parameters.' });
		}

		// 
		debug.lookup('Delivering metadata result.');
		debug.object(accounts[account_id]);

		// Return a 200 OK with the lookup result.
		return res.status(200).json({ identifier: account_identifier, information: accounts[account_id] });
	}
	catch(error)
	{
		// Log an error for an administrator to investigate.
		debug.errors('Failed to lookup account:', error);

		// Return a 500 Internal Server Error.
		return res.status(500).json({ error: error });
	}
});

module.exports = router;
