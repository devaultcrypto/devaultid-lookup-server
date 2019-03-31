// Enable support for Express apps.
const express = require('express');
const router = express.Router();

// Enable the bitcore-lib-cash library functions.
const BitcoreCash = require('bitcore-lib-cash');

// Wrap the register function in an async function.
const registerAccount = async function (req, res)
{
	if(!req.app.locals.config.server.register)
	{
		// Return a 501 Not Implemented
		return res.status(501).json({ error: 'The registration feature is disable on this service.' });
	}
	
	// Notify the server admin that a lookup request has been received.
	req.app.locals.debug.server('Account registration requested by ' + req.ip);
	req.app.locals.debug.object(req.body);

	let paymentData;
	let registrationScript = new BitcoreCash.Script();
	
	// Start by adding the OP_RETURN.
	registrationScript.add(BitcoreCash.Opcode.OP_RETURN);
	
	// Add the protocol identifier.
	registrationScript.add(Buffer.from(req.app.locals.protocol.identifierHex, "hex"));
	
	// Verify that the name matches the (/^[a-zA-Z0-9_]{1,99}$/) requirements.
	if(!req.app.locals.protocol.nameRegexp.test(req.body.name))
	{
		// Return a 400 Bad Request error..
		return res.status(400).json({ error: 'Account name is not valid.' });
	}
	
	// Add the requested alias string.
	registrationScript.add(Buffer.from(req.body.name, "utf8"));
	
	// Verify that the request has some payment data.
	if(!req.body.payments)
	{
		// Return a 400 Bad Request error..
		return res.status(400).json({ error: 'No payment data was supplied.' });
	}
	
	for(let index in req.body.payments)
	{
		// Add network if omitted.
		if(!req.body.payments[index].startsWith('bitcoincash:'))
		{
			req.body.payments[index] = 'bitcoincash:' + req.body.payments[index];
		}
		
		try
		{
			// Decode the payment data as if it was a CashAddr address.
			paymentData = BitcoreCash.Address._decodeCashAddress(req.body.payments[index]);
		}
		catch (error)
		{
			// Return a 500 Internal server error..
			return res.status(500).json({ error: 'Service unable to parse payment data.' });
		}
		
		// add the payment data to the script.
		if(paymentData.type == 'pubkeyhash')
		{
			registrationScript.add(Buffer.concat([Buffer.from('01', 'hex'), paymentData.hashBuffer]), "hex");
		}
		else if(paymentData.type == 'scripthash')
		{
			registrationScript.add(Buffer.concat([Buffer.from('02', 'hex'), paymentData.hashBuffer]), "hex");
		}
		else
		{
			// Return a 500 Internal server error..
			return res.status(500).json({ error: 'Service unable to understand payment data.' });
		}
	}
	
	// Get a list of available inputs from the node wallet.
	let inputs = await req.app.locals.rpc('listunspent', 0);

	// If we couldn't get any unspent outputs (= node has no funds)
	if(inputs.length == 0)
	{
		// Get a new address.
		let fundingAddress = await req.app.locals.rpc('getnewaddress');

		// Return a 402 Payment Required error..
		return res.status(402).json({ error: 'Service has no funds to pay for registration. You can help others by sending some funds to the service.', address: fundingAddress });
	}

	// Create a transaction from the inputs and set the fees to just over 1sat/b.
	let transaction = new BitcoreCash.Transaction().from(inputs).feePerKb(1001);

	// Add the registration output to the transaction.
	transaction.addOutput(new BitcoreCash.Transaction.Output({ script: registrationScript, satoshis: 0 }));
	
	// Get a change address.
	let changeAddress = await req.app.locals.rpc('getrawchangeaddress');
	
	// Add the change address to the transaction so that all non-fee funds goes back to the node.
	transaction.change(changeAddress);

	// Sign and then broadcast the transaction.
	let signedTransaction = await req.app.locals.rpc('signrawtransaction', transaction.toString());

	if(!signedTransaction.complete)
	{
		// Failed to sign transaction.
		return res.status(500).json({ error: 'Service failed to sign registration.' });
	}

	try
	{
		// Broadcast the transaction.
		let sentTransaction = await req.app.locals.rpc('sendrawtransaction', signedTransaction.hex);

		// Notify the server admin that a lookup request has been received.
		req.app.locals.debug.server('Account registration completed for ' + req.ip);
		req.app.locals.debug.object({ txid: sentTransaction, hex: signedTransaction.hex });

		// Return the TXID to the caller.
		return res.status(200).json({ txid: sentTransaction, hex: signedTransaction.hex });
	}
	catch (error)
	{
		// Failed to broadcast transaction.
		return res.status(500).json({ error: 'Service failed to broadcast registration.', details: error });
	}
}

// Call registerAccount when this route is requested.
router.post('/', registerAccount);

module.exports = router;
