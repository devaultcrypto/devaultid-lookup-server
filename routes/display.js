// Enable support for Express apps.
const express = require('express');
const router = express.Router();

//
router.get('/:accountName/:accountNumber/:accountHash?', async function (req, res)
{
	// Notify the server admin that a lookup request has been received.
	req.app.locals.debug.server('Account presentation requested by ' + req.ip);
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
	
	// Parse lookup identifer
	let lookupIdentifier = (req.params['accountName'] ? req.params['accountName'] : '') + '#' + req.params['accountNumber'] + (req.params['accountHash'] ? "." + req.params['accountHash'] : "");
	
	// Update the response object with the account identifier requested.
	lookupResult.identifier = lookupIdentifier;
	
	try
	{
		//
		req.app.locals.debug.struct('Starting to query database for registration metadata matching ' + lookupIdentifier);
		
		let databaseLookupResult = null;
		if(req.params['accountHash'])
		{
			// Query the database for the result.
			databaseLookupResult = req.app.locals.queries.metadataByIdentifier.all(req.params);
		}
		else
		{
			// Query the database for the result.
			databaseLookupResult = req.app.locals.queries.metadataByName.all(req.params);
		}
		
		//
		req.app.locals.debug.struct('Completed querying database for registration metadata matching ' + lookupIdentifier);
		
		// If no result could be found..
		if(typeof databaseLookupResult == 'object' && Object.keys(databaseLookupResult).length == 0)
		{
			// Notify the server admin that this request has no results.
			req.app.locals.debug.server('Delivering error message due to missing registrations to ' + req.ip);
			
			// Return 404 eror.
			return res.status(404).json({ error: 'No account could be found with the requested parameters.' });
		}
		
		// Initialize and empty list of matched accounts and last identifier.
		let accounts = {};
		let account_id = null;
		let account_identifier = null;
		
		//
		req.app.locals.debug.struct('Parsing database result into account metadata.');
		
		// If results were found, go over them and..
		for(resultIndex in databaseLookupResult)
		{
			// Set the current account id.
			account_id = databaseLookupResult[resultIndex].account_id;
			account_identifier = databaseLookupResult[resultIndex].name + '#' + databaseLookupResult[resultIndex].number + (databaseLookupResult[resultIndex].collision_length > 0 ? '.' + databaseLookupResult[resultIndex].collision_hash.substring(0, databaseLookupResult[resultIndex].collision_length) : '') + ';';
			
			// Parse account information.
			let account =
			{
				emoji: databaseLookupResult[resultIndex].emoji,
			  name: databaseLookupResult[resultIndex].name,
			  number: databaseLookupResult[resultIndex].number,
			  collision:
			  {
				  hash: databaseLookupResult[resultIndex].collision_hash,
			  count: databaseLookupResult[resultIndex].collision_count,
			  length: databaseLookupResult[resultIndex].collision_length,
			  },
			  payment: [],
			}
			
			if(typeof databaseLookupResult[resultIndex].payload_type != 'undefined' && typeof req.app.locals.protocol.payloadTypes[databaseLookupResult[resultIndex].payload_type] != 'undefined')
			{
				// Parse payment information.
				let paymentInformation =
				{
					type: req.app.locals.protocol.payloadTypes[databaseLookupResult[resultIndex].payload_type].name,
			  address: databaseLookupResult[resultIndex].payload_address,
				}
				
				// Add this payment information to the account.
				account.payment.push(paymentInformation);
			}
			
			// Assign the account to the list of accounts if needed.
			if(typeof accounts[account_id] == 'undefined')
			{
				accounts[account_id] = account;
			}
		}
		
		//
		req.app.locals.debug.struct('Completed parsing database result into account metadata.');
		
		// If more than one account was matched..
		if(Object.keys(accounts).length > 1)
		{
			// Notify the server admin that this request was invalid.
			req.app.locals.debug.server('Delivering error message due to conflicting results to ' + req.ip);
			req.app.locals.debug.object(databaseLookupResult);
			
			// Return a 409 Conflict.
			return res.status(409).json({ error: 'More than one account matched with the requested parameters.' });
		}

		//
		let url = req.protocol + '://' + req.get('host') + req.originalUrl;
		let title = accounts[account_id].emoji + ' ' + lookupIdentifier;
		let description = 'Cash Account payment information.';
		let image = 'https://www.cashaccount.info/img/logo_green.png';
		
		let payments = '';
		for(let index in accounts[account_id].payment)
		{
			payments += '<li><img src="http://chart.apis.google.com/chart?cht=qr&chs=300x300&chl=' + encodeURI(accounts[account_id].payment[index].address) + '" /><span>' + accounts[account_id].payment[index].address + '</span></li>';
		}

		if(accounts[account_id].payment.length == 1)
		{
			description = accounts[account_id].payment[0].address;
		}

		let article = '<article><header>' + title + '</header><section><ul>' + payments + '</ul></section></article>';
		let styles = '<style>header { font-size: 32pt; } ul { margin: 0; padding: 0; } article {width: 40rem; margin:auto;} img { width: 25rem; height: 25rem; margin: auto; } * { text-align:center; } li { display: flex; flex-direction: column; }</style>';
		let metadata = '<meta content="text/html; charset=UTF-8" name="Content-Type" /><meta name="twitter:card" content="summary"/><meta property="og:url" content="' + url + '"/><meta property="og:title" content="' + title + '"/><meta property="og:description" content="' + description + '"/><meta property="og:image" content="' + image + '"/>';
		let response = '<html lang="en" prefix="og: http://ogp.me/ns#"><head><title>' + title + '</title>' + metadata + styles + '</head><body>' + article + '</body></html>';
		
		// 
		req.app.locals.debug.server('Account presentation for ' + lookupIdentifier + ' delivered to ' + req.ip);
		req.app.locals.debug.object(accounts[account_id]);
		
		// Return a 200 OK with the lookup result.
		return res.status(200).send(response);
	}
	catch(error)
	{
		// Log an error for an administrator to investigate.
		req.app.locals.debug.errors('Failed to lookup account:', error);
		
		// Return a 500 Internal Server Error.
		return res.status(500).json({ error: error });
	}
});

module.exports = router;
