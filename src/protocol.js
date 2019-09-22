// ???
module.exports = function(app)
{
	//
	app.locals.debug.struct('Initializing protocol module.');

	// Enable the bitcore-lib-dvt library functions.
	const BitcoreCash = require('bitcore-lib-dvt');

	// Define protocol constants.
	app.locals.protocol =
	{
		identifierHex: '01010101',
		blockModifier: 563620,
		nameRegexp: /[a-zA-Z0-9_]{1,99}/,
		hashRegexp: /[0-9]{1,10}/,
		payloadTypes:
		{
			1: { name: 'Key Hash', length: 20 },
			2: { name: 'Script Hash', length: 20 },
			3: { name: 'Payment Code', length: 80 },
			4: { name: 'Stealth Keys', length: 66 },

			129: { name: 'Key Hash (Token Aware)', length: 20 },
			130: { name: 'Script Hash (Token Aware)', length: 20 },
			131: { name: 'Payment Code (Token Aware)', length: 80 },
			132: { name: 'Stealth Keys (Token Aware)', length: 66 },
		},
		emojiCodepoints: [ 128123, 128018, 128021, 128008, 128014, 128004, 128022, 128016, 128042, 128024, 128000, 128007, 128063, 129415, 128019, 128039, 129414, 129417, 128034, 128013, 128031, 128025, 128012, 129419, 128029, 128030, 128375, 127803, 127794, 127796, 127797, 127809, 127808, 127815, 127817, 127819, 127820, 127822, 127826, 127827, 129373, 129381, 129365, 127805, 127798, 127812, 129472, 129370, 129408, 127850, 127874, 127853, 127968, 128663, 128690, 9973, 9992, 128641, 128640, 8986, 9728, 11088, 127752, 9730, 127880, 127872, 9917, 9824, 9829, 9830, 9827, 128083, 128081, 127913, 128276, 127925, 127908, 127911, 127928, 127930, 129345, 128269, 128367, 128161, 128214, 9993, 128230, 9999, 128188, 128203, 9986, 128273, 128274, 128296, 128295, 9878, 9775, 128681, 128099, 127838 ],

		errors:
		{
			INVALID_NAME: 1,
			MISSING_PAYLOAD: 2,
			INVALID_PAYLOAD_LENGTH: 3
		},

		calculateAccountIdentity: function(blockhash, transactionhash)
		{
			// Step 1: Concatenate the block hash with the transaction hash
			let account_hash_step1 = Buffer.concat([blockhash, transactionhash]);;

			// Step 2: Hash the results of the concatenation with sha256
			let account_hash_step2 = BitcoreCash.crypto.Hash.sha256(account_hash_step1);

			// Step 3: Take the first and last four bytes and discard the rest
			let account_hash_step3 = account_hash_step2.slice(0, 4);
			let account_emoji_step3 = account_hash_step2.slice(28, 32);

			// Step 4a: Convert to decimal notation and store as a string
			let account_hash_step4 = account_hash_step3.readUInt32BE(0).toString(10);

			// Step 4b: Select an emoji from the emojiHexList
			let emoji_index = account_emoji_step3.readUInt32BE(0) % 100;

			// Step 5: Reverse the the string so the last number is first
			let account_hash_step5 = account_hash_step4.toString().split("").reverse().join("").padEnd(10, '0');

			// Step 5b: calculate the integer codepoint for the emoji
			let emoji_codepoint = app.locals.protocol.emojiCodepoints[emoji_index];
			
			// Return the final account identity.
			return { collisionHash: account_hash_step5, accountEmoji: emoji_codepoint };
		},

		parseAddress: function(payload_type, payload_data)
		{
			switch(payload_type)
			{
				// Type: Key Hash
				case 1:
				case 129:
				{
					return BitcoreCash.Address(payload_data, 'livenet', 'pubkeyhash').toCashAddress();
				}
				// Type: Script Hash
				case 2:
				case 130:
				{
					return BitcoreCash.Address(payload_data, 'livenet', 'scripthash').toCashAddress();
				}
				// Type: Payment Code
				case 3:
				case 131:
				{
					return BitcoreCash.encoding.Base58Check.encode(Buffer.concat([ Buffer.from('47', 'hex'), payload_data ]));
				}
				// Type: Stealth Keys
				case 4:
				case 132:
				{
					return null;
				}
			}
		},
	}

	//
	app.locals.debug.struct('Completed protocol module initialization.');
}
