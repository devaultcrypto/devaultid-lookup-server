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
const sql = new Database(config.server.database, { memory: false, readonly: true });

// Load the database queries.
const queries = 
{
	lookupByIdentifier: sql.prepare(filesystem.readFileSync('sql/query_lookup_by_identifier.sql', 'utf8').trim()),
	lookupByName: sql.prepare(filesystem.readFileSync('sql/query_lookup_by_name.sql', 'utf8').trim()),
	lookupByBlock: sql.prepare(filesystem.readFileSync('sql/query_lookup_by_block.sql', 'utf8').trim()),
};

// Define protocol constants.
const protocol = 
{
	blockModifier: 563620,
}

// Enable support for Express apps.
const express = require('express');
const router = express.Router();

//
router.get('/:accountNumber/:accountName?/:accountHash?', async function (req, res)
{
	//
	let lookupIdentifier = (req.params['accountName'] ? req.params['accountName'] : '') + '#' + req.params['accountNumber'] + (req.params['accountHash'] ? "." + req.params['accountHash'] : "");

	//
	debug.lookup('Registration transaction(s) for ' + lookupIdentifier + ' requested by ' + req.ip);

	// Initialize response object.
	let lookup =
	{
		identifier: lookupIdentifier,
		block: parseInt(req.params['accountNumber']) + protocol.blockModifier,
		results: null
	}

	try
	{
		let result = null;
		if(req.params['accountHash'])
		{
			// Query the database for the result.
			result = queries.lookupByIdentifier.all(req.params);
		}
		else if(req.params['accountName'])
		{
			// Query the database for the result.
			result = queries.lookupByName.all(req.params);
		}
		else
		{
			// Query the database for the result.
			result = queries.lookupByBlock.all(req.params);
		}

		// If no result could be found..
		if(typeof result == 'object' && Object.keys(result).length == 0)
		{
			// Return 404 eror.
			return res.status(404).json({ error: 'No account matched the requested parameters.' });
		}

		// If a hash was provided and more than one result was found..
		if(req.params['accountHash'] && Object.keys(result).length > 1)
		{
			// Return a 409 Conflict.
			return res.status(409).json({ error: 'More than one account matched with the requested parameters.' });
		}

		// If results were found, go over them and..
		for(resultIndex in result)
		{
			// .. check if they have a cached transaction and inclusion proof and ..
			if(!result[resultIndex].inclusion_proof)
			{
				// .. if the given registration lacks a proof, fetch it from the full node on-demand.
				result[resultIndex].inclusion_proof = await rpc.getTxoutProof([ result[resultIndex].transaction_hash ], result[resultIndex].block_hash);
				result[resultIndex].transaction = await rpc.getRawTransaction(result[resultIndex].transaction_hash);
			}

			// Remove the block and transaction hash from the result set.
			delete result[resultIndex].block_hash;
			delete result[resultIndex].transaction_hash;
		}

		// Add the final data to the result of the response object.
		lookup.results = result;

		// 
		debug.lookup('Registration transaction(s) for ' + lookupIdentifier + ' delivered to ' + req.ip);
		debug.object(lookup);

		// Return a 200 OK with the lookup result.
		return res.status(200).json(lookup);
	}
	catch(error)
	{
		// Log an error for an administrator to investigate.
		debug.errors('Failed to lookup account:', error);

		// Return a 500 Internal Server Error.
		return res.status(500);
	}
});

module.exports = router;
