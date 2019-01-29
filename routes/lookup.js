// Enable support for Express apps.
const express = require('express');
const router = express.Router();

// TODO: 429 TOO_MANY_REQUESTS? (rate limiter)
// TODO: 451 NOT_LEGAL?
// TODO: 503 SERVICE UNAVAILABLE?
//
router.get('/:accountNumber/:accountName?/:accountHash?', async function (req, res)
{
	//
	let lookupIdentifier = (req.params['accountName'] ? req.params['accountName'] : '') + '#' + req.params['accountNumber'] + (req.params['accountHash'] ? "." + req.params['accountHash'] : "");

	//
	req.app.locals.debug.lookup('Registration transaction(s) for ' + lookupIdentifier + ' requested by ' + req.ip);

	// Validate that the account number is in the given range.
	if(req.params['accountNumber'] && parseInt(req.params['accountNumber']) < 100)
	{
		return res.status(400).json({ error: 'The account number is not in the valid range.' });
	}

	// Validate the account name.
	if(req.params['accountName'] && !req.app.locals.protocol.nameRegexp.test(req.params['accountName']))
	{
		return res.status(400).json({ error: 'The account name is not valid.' });
	}

	// Validate the account hash part, if supplied.
	if(req.params['accountHash'] && !req.app.locals.protocol.hashRegexp.test(req.params['accountHash']))
	{
		return res.status(400).json({ error: 'The account hash part is not valid.' });
	}

	// Initialize response object.
	let lookup =
	{
		identifier: lookupIdentifier,
		block: parseInt(req.params['accountNumber']) + req.app.locals.protocol.blockModifier,
		results: null
	}

	try
	{
		let result = null;
		if(req.params['accountHash'])
		{
			// Query the database for the result.
			result = req.app.locals.queries.lookupByIdentifier.all(req.params);
		}
		else if(req.params['accountName'])
		{
			// Query the database for the result.
			result = req.app.locals.queries.lookupByName.all(req.params);
		}
		else
		{
			// Query the database for the result.
			result = req.app.locals.queries.lookupByBlock.all(req.params);
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
		req.app.locals.debug.lookup('Registration transaction(s) for ' + lookupIdentifier + ' delivered to ' + req.ip);
		req.app.locals.debug.object(lookup);

		// Return a 200 OK with the lookup result.
		return res.status(200).json(lookup);
	}
	catch(error)
	{
		// Log an error for an administrator to investigate.
		req.app.locals.debug.errors('Failed to lookup account:', error);

		// Return a 500 Internal Server Error.
		return res.status(500);
	}
});

module.exports = router;
