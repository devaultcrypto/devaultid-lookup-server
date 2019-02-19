// Enable support for Express apps.
const express = require('express');
const router = express.Router();

// TODO: 429 TOO_MANY_REQUESTS? (rate limiter)
// TODO: 451 NOT_LEGAL?
// TODO: 503 SERVICE UNAVAILABLE?
//
router.get('/:accountNumber/:accountName?/:accountHash?', async function (req, res)
{
	// Notify the server admin that a lookup request has been received.
	req.app.locals.debug.server('Registration transaction(s) requested by ' + req.ip);
	req.app.locals.debug.struct('Validating lookup request input fields.');

	// Initialize an empty response object.
	let lookupResult = {};

	// Validate that the account number is in the given range.
	if(req.params['accountNumber'] && parseInt(req.params['accountNumber']) < 100)
	{
		lookupResult.error = 'The account number is not in the valid range.';
	}

	// Validate the account name.
	if(req.params['accountName'] && !req.app.locals.protocol.nameRegexp.test(req.params['accountName']))
	{
		lookupResult.error = 'An optional account name was supplied but is not valid.';
	}

	// Validate the account hash part, if supplied.
	if(req.params['accountHash'] && !req.app.locals.protocol.hashRegexp.test(req.params['accountHash']))
	{
		lookupResult.error = 'An optional account hash part was supplied but is not valid.';
	}

	//
	req.app.locals.debug.struct('Completed validation of lookup request input fields.');

	// If validation failed..
	if(typeof lookupResult.error != 'undefined')
	{
		// Notify the server admin that this request was invalid.
		req.app.locals.debug.server('Delivering error message due to invalid request to ' + req.ip);
		req.app.locals.debug.object(lookupResult);

		// Return a 400 BAD REQUEST response.
		return res.status(400).json(lookupResult);
	}

	// Parse lookup identifier.
	let lookupIdentifier = (req.params['accountName'] ? req.params['accountName'] : '') + '#' + req.params['accountNumber'] + (req.params['accountHash'] ? "." + req.params['accountHash'] : "");

	// Update the response object with the block and account identifier requested.
	lookupResult.identifier = lookupIdentifier;
	lookupResult.block = parseInt(req.params['accountNumber']) + req.app.locals.protocol.blockModifier;

	try
	{
		//
		req.app.locals.debug.struct('Starting to query database for registration transaction(s) matching ' + lookupIdentifier);

		let databaseLookupResult = null;
		if(req.params['accountHash'])
		{
			// Query the database for the result.
			databaseLookupResult = req.app.locals.queries.lookupByIdentifier.all(req.params);
		}
		else if(req.params['accountName'])
		{
			// Query the database for the result.
			databaseLookupResult = req.app.locals.queries.lookupByName.all(req.params);
		}
		else
		{
			// Query the database for the result.
			databaseLookupResult = req.app.locals.queries.lookupByBlock.all(req.params);
		}

		//
		req.app.locals.debug.struct('Completed querying database for registration transaction(s) matching ' + lookupIdentifier);

		// If no result could be found..
		if(typeof databaseLookupResult == 'object' && Object.keys(databaseLookupResult).length == 0)
		{
			// Notify the server admin that this request has no results.
			req.app.locals.debug.server('Delivering error message due to missing registrations to ' + req.ip);

			// Return 404 eror.
			return res.status(404).json({ error: 'No account matched the requested parameters.' });
		}

		// If a hash was provided and more than one result was found..
		if(req.params['accountHash'] && Object.keys(databaseLookupResult).length > 1)
		{
			// Notify the server admin that this request was invalid.
			req.app.locals.debug.server('Delivering error message due to conflicting results to ' + req.ip);
			req.app.locals.debug.object(databaseLookupResult);

			// Return a 409 Conflict.
			return res.status(409).json({ error: 'More than one account matched with the requested parameters.' });
		}

		// If results were found, go over them and..
		for(resultIndex in databaseLookupResult)
		{
			//
			req.app.locals.debug.struct('Checking if inclusions proofs and transaction data is cached locally.');

			// .. check if they have a cached transaction and inclusion proof and ..
			if(!databaseLookupResult[resultIndex].inclusion_proof)
			{
				//
				req.app.locals.debug.struct('Requesting inclusions proofs and transaction data from RPC node.');

				// .. if the given registration lacks a proof, fetch it from the full node on-demand.
				databaseLookupResult[resultIndex].inclusion_proof = await req.app.locals.rpc('getTxoutProof', [databaseLookupResult[resultIndex].transaction_hash], databaseLookupResult[resultIndex].block_hash);
				databaseLookupResult[resultIndex].transaction = await req.app.locals.rpc('getRawTransaction', databaseLookupResult[resultIndex].transaction_hash);

				//
				req.app.locals.debug.struct('Received inclusions proofs and transaction data from RPC node.');
			}

			// Remove the block and transaction hash from the result set.
			delete databaseLookupResult[resultIndex].block_hash;
			delete databaseLookupResult[resultIndex].transaction_hash;
		}

		// Add the final data to the result of the response object.
		lookupResult.results = databaseLookupResult;

		// Notify the server admin that the request has been processed.
		req.app.locals.debug.server('Registration transaction(s) for ' + lookupIdentifier + ' delivered to ' + req.ip);
		req.app.locals.debug.object(lookupResult);

		// Return a 200 OK with the lookup result.
		return res.status(200).json(lookupResult);
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
