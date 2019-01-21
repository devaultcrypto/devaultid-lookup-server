// Enable support for configurable debugging.
const debug =
{
	lookup: require('debug')('calus:lookup'),
	errors: require('debug')('calus:errors'),
}

// Enable lookup messages by default.
debug.lookup.enabled = true;
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
router.get('/:accountNumber', async function (req, res)
{
	//
	debug.lookup('Lookup requested for block #' + req.params['accountNumber']);

	// Initialize response object.
	let lookup =
	{
		block: parseInt(req.params['accountNumber']) + protocol.blockModifier,
		results: null
	}

	try
	{
		// Query the database for the result.
		let result = queries.lookupByBlock.all({ account_number: req.params['accountNumber'] });

		// If no result could be found..
		if(typeof result == 'object' && result.length == 0)
		{
			// Return 404 eror, and an empty result set.
			return res.status(404).json(lookup);
		}

		// If results were found, go over them and..
		for(resultIndex in result)
		{
			// .. check if they have a cached transaction and inclusion proof and ..
			if(!result[resultIndex].inclusion_proof)
			{
				// .. if the given registration lacks a proof, fetch it from the full node on-demand.
				result[resultIndex].inclusion_proof = await rpc.getTxoutProof([ result[resultIndex].transaction_hash ]);
				result[resultIndex].transaction = await rpc.getRawTransaction(result[resultIndex].transaction_hash);
			}

			// Remove the transaction hash from the result set.
			delete result[resultIndex].transaction_hash;
		}

		// Add the final data to the result of the response object.
		lookup.results = result;

		// 
		debug.lookup('Delivering lookup result:', typeof result);

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

//
router.get('/:accountNumber/:accountName', async function (req, res)
{
	//
	debug.lookup('Lookup requested for ' + req.params['accountName'] + '#' + req.params['accountNumber']);

	// Initialize response object.
	let lookup =
	{
		name: req.params['accountName'],
		block: parseInt(req.params['accountNumber']) + protocol.blockModifier,
		results: null
	}

	try
	{
		// Query the database for the result.
		let result = queries.lookupByName.all({ account_number: req.params['accountNumber'], account_name: req.params['accountName'] });

		// If no result could be found..
		if(typeof result == 'object' && result.length == 0)
		{
			// Return 404 eror, and an empty result set.
			return res.status(404).json(lookup);
		}

		// If results were found, go over them and..
		for(resultIndex in result)
		{
			// .. check if they have a cached transaction and inclusion proof and ..
			if(!result[resultIndex].inclusion_proof)
			{
				// .. if the given registration lacks a proof, fetch it from the full node on-demand.
				result[resultIndex].inclusion_proof = await rpc.getTxoutProof([ result[resultIndex].transaction_hash ]);
				result[resultIndex].transaction = await rpc.getRawTransaction(result[resultIndex].transaction_hash);
			}

			// Remove the transaction hash from the result set.
			delete result[resultIndex].transaction_hash;
		}

		// Add the final data to the result of the response object.
		lookup.results = result;

		// 
		debug.lookup('Delivering lookup result:', typeof result);

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
