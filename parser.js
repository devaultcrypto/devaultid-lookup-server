// Read the configuration file.
const config = require("./config.js");

// Enable support for filesystem operations.
const filesystem = require('fs');

// Enable support for cryptographic functions.
const crypto = require('crypto');

// Enable RPC connections.
const bchRPC = require('bitcoin-cash-rpc');
const rpc = new bchRPC(config.node.address, config.node.user, config.node.pass, config.node.port, 5000);

// Enable support for sqlite databases.
const Database = require('better-sqlite3');

// Open the database in read-write mode.
const sql = new Database(config.storage.filename, { readonly: false });

// Enable support for foreign keys.
sql.pragma('foreign_keys = ON');

// Load the available database queries.
const queryStoreBlock = filesystem.readFileSync('sql/query_store_block.sql', 'utf8');
const queryLinkBlock = filesystem.readFileSync('sql/query_link_block.sql', 'utf8');

// Load the available schemas.
const schemaMinimal = filesystem.readFileSync('sql/schema_minimal.sql', 'utf8');
const schemaDefault = filesystem.readFileSync('sql/schema_default.sql', 'utf8');
const schemaExtended = filesystem.readFileSync('sql/schema_extended.sql', 'utf8');

// Create the minimal schema
if(true)
{
	sql.exec(schemaMinimal);
}

// Create the default schema if necessary
if(config.mode == 'default' || config.mode == 'extended')
{
	sql.exec(schemaDefault);
}

// Create the extended schema if necessary
if(config.mode == 'extended')
{
	sql.exec(schemaExtended);
}

// Find a blockheight to request.
let block_chain = sql.prepare('SELECT block_hash, block_height FROM service_status LEFT JOIN blocks ON (chain_tip = block_hash)').get();

let oldBlockHash = block_chain.block_hash;
let newBlockHeight = block_chain.block_height + 1;

const protocol =
{
	blockModifier: 563620,
	nameRegexp: /[a-zA-Z0-9_]{1,99}/,
	emojiCodepoints: [ 128123, 128018, 128021, 128008, 128014, 128004, 128022, 128016, 128042, 128024, 128000, 128007, 128063, 129415, 128019, 128039, 129414, 129417, 128034, 128013, 128031, 128025, 128012, 129419, 128029, 128030, 128375, 127803, 127794, 127796, 127797, 127809, 127808, 127815, 127817, 127819, 127820, 127822, 127826, 127827, 129373, 129381, 129365, 127805, 127798, 127812, 129472, 129370, 129408, 127850, 127874, 127853, 127968, 128663, 128690, 9973, 9992, 128641, 128640, 8986, 9728, 11088, 127752, 9730, 127880, 127872, 9917, 9824, 9829, 9830, 9827, 128083, 128081, 127913, 128276, 127925, 127908, 127911, 127928, 127930, 129345, 128269, 128367, 128161, 128214, 9993, 128230, 9999, 128188, 128203, 9986, 128273, 128274, 128296, 128295, 9878, 9775, 128681, 128099, 127838 ]
}

//
const calculateAccountIdentity = function(blockhash, transactionhash)
{
	// Step 1: Concatenate the block hash with the transaction hash
	let account_hash_step1 = Buffer.concat([blockhash, transactionhash]);;
//console.log(account_hash_step1);
	// Step 2: Hash the results of the concatenation with sha256
	let account_hash_step2 = crypto.createHash('sha256').update(account_hash_step1).digest();
//console.log(account_hash_step2);
	// Step 3: Take the first and last four bytes and discard the rest
	let account_hash_step3 = account_hash_step2.slice(0, 4);
	let account_emoji_step3 = account_hash_step2.slice(28, 32);
//console.log('step 3a:', account_hash_step3);
//console.log('step 3b:', account_emoji_step3);
	// Step 4a: Convert to decimal notation and store as a string
	let account_hash_step4 = account_hash_step3.readUInt32BE(0).toString(10);
//console.log('step 4a:', account_hash_step4);
	// Step 4b: Select an emoji from the emojiHexList
	let emoji_index = account_emoji_step3.readUInt32BE(0) % 100;
//console.log('step 4b:', emoji_index);
	// Step 5: Reverse the the string so the last number is first
	let account_hash_step5 = account_hash_step4.toString().split("").reverse().join("").padEnd(10, '0');
//console.log('step 5a:', account_hash_step5);
	// Step 5b: calculate the integer codepoint for the emoji
	let emoji_codepoint = protocol.emojiCodepoints[emoji_index];
//console.log('step 5b:', emoji_codepoint);
	
	// Return the final account identity.
	return { collisionHash: account_hash_step5, accountEmoji: emoji_codepoint };
};


(async function()
{
	let newBlockHashHex = await rpc.getBlockHash(newBlockHeight);
	let newBlockHash = Buffer.from(newBlockHashHex, 'hex');

	// Store the block and link it to its parent and itself as the chain tip.
	sql.prepare(queryStoreBlock).run({ block_hash: newBlockHash, block_height: newBlockHeight });
	sql.prepare(queryLinkBlock).run({ block_hash: newBlockHash, parent_hash: oldBlockHash, chain_hash: newBlockHash });

	let newBlock = await rpc.getBlock(newBlockHashHex, true, true);
	let transactionList = newBlock.tx;

	console.log('Parsing block #' + newBlockHeight + ' [' + newBlockHashHex + ']:');

	/*
	 * 1) To register a Cash Account you broadcast a Bitcoin Cash transaction 
	 * 2) with a single OP_RETURN output in any position, 
	 * 3) containing a Protocol Identifier, an Account Name and 
	 * 4) one or more Payment Data.
	 */

	// 1) Validating that there is a mined (and therefor broadcasted) registration transaction
	for(transactionIndex in transactionList)
	{
		// Copy transaction hash locally for legibility.
		let transactionHashHex = transactionList[transactionIndex];
		let transactionHash = Buffer.from(transactionHashHex, 'hex');

		try
		{
			// Get the raw transaction.
			let transaction = await rpc.getRawTransaction(transactionHashHex, 1);

			// Initialize control parameters to measure OP_RETURN outputs.
			let opReturnCount = 0;
			let opReturnIndex = null;

			// Go over each output in the transction and ..
			for(outputIndex in transaction.vout)
			{
				// Copy output to a local variable for legibility.
				let currentOuput = transaction.vout[outputIndex];

				// Check if this output starts with an OP_RETURN opcode.
				if(currentOuput.scriptPubKey.hex.startsWith('6a'))
				{
					// Increase the counter and store a link to this output.
					opReturnCount += 1;
					opReturnIndex = outputIndex;
				}
			}

			// 2a) Validate that there exist at least one OP_RETURN output.
			if(opReturnCount = 0)
			{
				console.log('Discarding [' + transactionHashHex + ']: Missing OP_RETURN output.');
				continue;
			}

			// 2b) Validating that there exist no more than a single OP_RETURN output.
			if(opReturnCount > 1)
			{
				console.log('Discarding [' + transactionHashHex + ']: Multiple OP_RETURN outputs.');
				continue;
			}

			// 3a) Validating that it has a protocol identifier
			if(!transaction.vout[opReturnIndex].scriptPubKey.hex.startsWith('6a0401010101'))
			{
				console.log('Discarding [' + transactionHashHex + ']: Invalid protocol identifier.');
				continue;
			}

			// Store the remainder of the transaction hex, after discarding the OP_RETURN and PROTOCOL IDENTIFIER push.
			let registration = Buffer.from(transaction.vout[opReturnIndex].scriptPubKey.hex, 'hex').slice(6);
			let registrationParts = [];

			// While there is still data in the output..
			while(registration.length > 0)
			{
				// Initialize default push and drop lengths.
				let pushLength = 0;
				let dropLength = 1;

				// Read the current opCode.
				let opCode = registration.readUInt8(0);

				// Determine the length of the pushed data and control codes.
				if(opCode <= 75) { pushLength = opCode; }
				if(opCode == 76) { pushLength = registration.readUint8(0);    dropLength += 1; }
				if(opCode == 77) { pushLength = registration.readUint16BE(0); dropLength += 2; }
				if(opCode == 78) { pushLength = registration.readUint32BE(0); dropLength += 4; }

				// Remove the control codes.
				registration = registration.slice(dropLength);

				// Push the value to the parts array.
				registrationParts.push(registration.slice(0, pushLength));

				// Remove the value data.
				registration = registration.slice(pushLength);
			}

			// Initilalize an empty account object.
			let account = {};
			let accountIdentity = calculateAccountIdentity(newBlockHash, transactionHash);

			account.name = registrationParts[0].toString();
			account.number = newBlockHeight - protocol.blockModifier;
			account.hash = accountIdentity.collisionHash;
			account.emoji = String.fromCodePoint(accountIdentity.accountEmoji);

			// 3b) Validating that it has a valid account name.
			if(!protocol.nameRegexp.test(account.name))
			{
				console.log('Discarding [' + transactionHashHex + ']: Invalid account name.');
				continue;
			}

			// 4) Validating that there exist at least one payment information
			if(registrationParts.length <= 1)
			{
				console.log('Discarding [' + transactionHashHex + ']: Missing payment information.');
				continue;
			}

			account.paymentInformation = [];
			
			
			console.log('Parsed registration for [' + account.emoji + "] " + account.name + "#" + account.number + "." + account.hash);
		}
		catch (error)
		{
			//
		}
	}

	process.exit();
})();


/*
class Test
{
	async something()
	{
		let a = await stuff();
	}
}

				let transactionList = getblock.result.tx;

				// Fetch detailed information on the transaction.
				rpc.call('getrawtransaction', [transactionHash, 1], (error, getrawtransaction) => 
				{
					callback();

					if(error)
					{
						console.log("getblockhash", error);
						//return res.status(500).json({ err: err });
					}
					else
					{
						
						console.log(getrawtransaction.result.vout);
					}
				});
			}

			// getblock.result.hash = ""
			// getblock.result.tx = []
			//console.log(getblock.result.hash, getblock.result.tx);
*/

process.on
(
	'beforeExit', 
	function(code)
	{
		console.log('Closing the database.');

		// Close the database.
		sql.close();
	}
);
