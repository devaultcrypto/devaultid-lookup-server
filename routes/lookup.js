const express = require('express');
const router = express.Router();
const bch = require('bitcore-lib-cash');

router.get('/:accountNumber/:accountName', async function (req, res)
{
	// req.params['accountNumber']
	// req.params['accountName']

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
