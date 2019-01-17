const express = require('express');
const router = express.Router();
const rpc = require('node-bitcoin-rpc');
const bch = require('bitcore-lib-cash');

router.get('/:accountNumber/:accountName', async function (req, res)
{
	// req.params['accountNumber']
	// req.params['accountName']

	rpc.init(process.env.ABC_RPC_ADDR, process.env.ABC_RPC_PORT, process.env.ABC_RPC_USER, process.env.ABC_RPC_PASS);
	// pentuple timeout length from 500 to 2500 (2.5seconds).
	rpc.setTimeout(2500)

	rpc.call('listunspent', [0], (err, r) => 
	{
		if(err)
		{
			console.log("listunspent", err);
			return res.status(500).json({ err: err });
		}

		const utxos = r.result;

		return res.status(200).json({ txid: r.result });
	});
});

module.exports = router;
