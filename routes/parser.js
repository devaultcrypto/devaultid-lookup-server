// Enable support for configurable debugging.
const debug =
{
	struct: require('debug')('calus:struct'),
	status: require('debug')('calus:status'),
	blocks: require('debug')('calus:blocks'),
	action: require('debug')('calus:action'),
	result: require('debug')('calus:result'),
	object: require('debug')('calus:object'),
	silent: require('debug')('calus:silent'),

	timer1: require('debug')('calus:timer1'),
	timer2: require('debug')('calus:timer2'),
	timer3: require('debug')('calus:timer3'),
	timer4: require('debug')('calus:timer4'),
	timer5: require('debug')('calus:timer5'),
	timer6: require('debug')('calus:timer6'),
}

// Enable status by default.
debug.status.enabled = true;
debug.blocks.enabled = true;
debug.result.enabled = true;

// Issue an initial debug message so we can measure loading times.
debug.struct('Started application.');

// Read the configuration file.
const config = require("../config.js");

// Enable support for filesystem operations.
const filesystem = require('fs');

// Enable support for cryptographic functions.
const crypto = require('crypto');

// Enable the bitcore-lib-cash library functions.
const bch = require('bitcore-lib-cash');

// Enable support for sqlite databases.
const Database = require('better-sqlite3');

// Enable RPC connections.
const bchRPC = require('bitcoin-cash-rpc');

// Helper function that allows deep assignments without need to create intermediate empty objects.
deepSet = (input) => 
{
	handler = {
		get: (obj, prop) => {
			obj[prop] = obj[prop] || {};
			return deepSet(obj[prop]);
		}
	};
	return new Proxy(input, handler);
};

// 
debug.struct('Loaded dependencies.');

//
const rpc = new bchRPC(config.node.address, config.node.user, config.node.pass, config.node.port, 5000);

debug.status('Connected to RPC node');

// Open the database in read-write mode.
const sql = new Database(config.server.database, { memory: false, readonly: false });

// 
debug.status('Opened database.');

// Enable support for foreign keys.
sql.pragma('foreign_keys = ON');

// Use up to 128mb memory as cache.
//sql.pragma('cache_size = 32768');

// At the risk of database corruption, don't wait for filesystem.
sql.pragma('synchronous = OFF');

// Allow the database to lock the database file on the operating system level.
//sql.pragma('locking_mode = EXCLUSIVE');

// Allow the database to keep the journal file when not in use, to prevent re-creating it repeatadly.
sql.pragma('journal_mode = TRUNCATE');

//
debug.timer3('Preparing database schema.');

// Load the database schema.
const databaseSchema = filesystem.readFileSync('sql/database_schema.sql', 'utf8').trim();

// Create the database schema.
sql.exec(databaseSchema);

//
debug.timer3('Completed database schema.');
//
debug.timer3('Preparing database queries.');

// Load the available database queries.
const queries =
{
	// Block related queries.
	getBlockByHash:				sql.prepare(filesystem.readFileSync('sql/query_get_block_by_hash.sql', 'utf8').trim()),
	storeBlock:					sql.prepare(filesystem.readFileSync('sql/query_store_block.sql', 'utf8').trim()),
	linkBlock:					sql.prepare(filesystem.readFileSync('sql/query_link_block.sql', 'utf8').trim()),

	// Transaction related queries.
	storeTransaction:			sql.prepare(filesystem.readFileSync('sql/query_store_transaction.sql', 'utf8').trim()),
	getTransactionByHash:		sql.prepare(filesystem.readFileSync('sql/query_get_transaction_by_hash.sql', 'utf8').trim()),
	linkBlockTransaction:		sql.prepare(filesystem.readFileSync('sql/query_link_block_transaction.sql', 'utf8').trim()),

	// Payload related queries.
	getPayload:					sql.prepare(filesystem.readFileSync('sql/query_get_payload.sql', 'utf8').trim()),
	storePayload:				sql.prepare(filesystem.readFileSync('sql/query_store_payload.sql', 'utf8').trim()),
	linkAccountPayload:			sql.prepare(filesystem.readFileSync('sql/query_link_account_payload.sql', 'utf8').trim()),

	// Account related queries.
	storeAccount:				sql.prepare(filesystem.readFileSync('sql/query_store_account.sql', 'utf8').trim()),
	getAccountByTransactionId:	sql.prepare(filesystem.readFileSync('sql/query_get_account_by_transaction_id.sql', 'utf8').trim()),

	//
	storeName:					sql.prepare(filesystem.readFileSync('sql/query_store_name.sql', 'utf8').trim()),
	getName:					sql.prepare(filesystem.readFileSync('sql/query_get_name.sql', 'utf8').trim()),

	// Other queries.
	invalidateRegistration:		sql.prepare(filesystem.readFileSync('sql/query_invalidate_registration.sql', 'utf8').trim()),
	getServiceStatus:			sql.prepare(filesystem.readFileSync('sql/query_get_service_status.sql', 'utf8').trim()),
	updateServiceStatus:		sql.prepare(filesystem.readFileSync('sql/query_update_service_status.sql', 'utf8').trim()),
	updateChainTip:				sql.prepare(filesystem.readFileSync('sql/query_update_chain_tip.sql', 'utf8').trim()),
}

//
debug.timer3('Finished preparing database queries.');

// 
debug.struct('Initialized database schema.');

const protocol =
{
	blockModifier: 563620,
	nameRegexp: /[a-zA-Z0-9_]{1,99}/,
	payloadTypes:
	{
		1: { name: 'Key Hash', length: 20 },
		2: { name: 'Script Hash', length: 20 },
		3: { name: 'Payment Code', length: 80 },
		4: { name: 'Stealth Keys', length: 66 }
	},
	emojiCodepoints: [ 128123, 128018, 128021, 128008, 128014, 128004, 128022, 128016, 128042, 128024, 128000, 128007, 128063, 129415, 128019, 128039, 129414, 129417, 128034, 128013, 128031, 128025, 128012, 129419, 128029, 128030, 128375, 127803, 127794, 127796, 127797, 127809, 127808, 127815, 127817, 127819, 127820, 127822, 127826, 127827, 129373, 129381, 129365, 127805, 127798, 127812, 129472, 129370, 129408, 127850, 127874, 127853, 127968, 128663, 128690, 9973, 9992, 128641, 128640, 8986, 9728, 11088, 127752, 9730, 127880, 127872, 9917, 9824, 9829, 9830, 9827, 128083, 128081, 127913, 128276, 127925, 127908, 127911, 127928, 127930, 129345, 128269, 128367, 128161, 128214, 9993, 128230, 9999, 128188, 128203, 9986, 128273, 128274, 128296, 128295, 9878, 9775, 128681, 128099, 127838 ],
	errors:
	{
		INVALID_NAME: 1,
		MISSING_PAYLOAD: 2,
		INVALID_PAYLOAD_LENGTH: 3
	}
}

//
const calculateAccountIdentity = function(blockhash, transactionhash)
{
	// Step 1: Concatenate the block hash with the transaction hash
	let account_hash_step1 = Buffer.concat([blockhash, transactionhash]);;

	// Step 2: Hash the results of the concatenation with sha256
	let account_hash_step2 = crypto.createHash('sha256').update(account_hash_step1).digest();

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
	let emoji_codepoint = protocol.emojiCodepoints[emoji_index];
	
	// Return the final account identity.
	return { collisionHash: account_hash_step5, accountEmoji: emoji_codepoint };
};

// Set initial parsing state.
var parserState = null;

// Wrap the parsing function in an async function.
const parseBlock = async function (req, res)
{
	debug.timer6('Got notified of new block(s).');

	// Return OK if we're already indexing.
	if(parserState)
	{
		return res.status(200).json(null);
	}
	else
	{
		parserState = true;
	}

	let iterations = 123456789;
	while(iterations--)
	{
		// Find a blockheight to request.
		let getServiceStatusResult = queries.getServiceStatus.get();

		//
		debug.struct('Loaded indexing service state.');
		debug.object(getServiceStatusResult);

		debug.timer1("Starting to parse block");
		debug.timer2("-");

		// Initialize an empty block object.
		let block = 
		{
			hash: null,
			hashHex: null,
			height: null,

			parentHash: null,
			parentHashHex: null,
			parentHeight: null,

			accounts: [] 
		};

		// Store information on the parent block.
		block.parentHash = getServiceStatusResult.block_hash;
		block.parentHeight = getServiceStatusResult.block_height;

		// Store information on the current block.
		block.height = getServiceStatusResult.block_height + 1;

		// Request the current blocks hash from the RPC node.
		let getBlockHashResult = await rpc.getBlockHash(block.height);

		// Check if the block was valid.
		if(typeof getBlockHashResult != 'string')
		{
			// If the block cannot be found due to not being indexed by full node yet..
			if(getBlockHashResult.error.code == -8)
			{
				//
				debug.silent('Requested a block height that does not yet exist.');

				// break the while loop.
				break;
			}
		}

		// Store the block hash a hex string and buffer.
		block.hashHex = getBlockHashResult;
		block.hash = Buffer.from(block.hashHex, 'hex');

		//
		debug.timer2("RPC: getBlockHash");

		// Store the block in the database (if necessary)
		queries.storeBlock.run(block);

		//
		debug.timer2("SQL: storeBlock");

		// Load the block and its parent from the database.
		let getCurrentBlockResult = queries.getBlockByHash.get(block);
		let getParentBlockResult = queries.getBlockByHash.get(block);

		//
		debug.timer2("SQL: getBlockByHash (current and parent)");

		// Link the block to its parent.
		queries.linkBlock.run(block);

		//
		debug.timer2("SQL: linkBlock");

		//
		debug.blocks('Parsing block #' + block.height + ' [' + block.hashHex + ']');

		let newBlock = await rpc.getBlock(block.hashHex, true, true);
		let transactionList = newBlock.tx;

		/*
		* 1) To register a Cash Account you broadcast a Bitcoin Cash transaction 
		* 2) with a single OP_RETURN output in any position, 
		* 3) containing a Protocol Identifier, an Account Name and 
		* 4) one or more Payment Data.
		*/

		// 1) Validating that there is a mined (and therefor broadcasted) registration transaction
		for(transactionIndex in transactionList)
		{
			// Initialize an empty transaction object.
			let transaction = {};

			// Copy transaction hash locally for legibility.
			transaction.hashHex = transactionList[transactionIndex];
			transaction.hash = Buffer.from(transaction.hashHex, 'hex');

			// Initialize empty values for the transaction body and proof.
			transaction.proof = null;
			transaction.body = null;

			//
			debug.struct("Transaction [" + transaction.hashHex + "]");
			debug.timer2("-");

			try
			{
				// Get the raw transaction.
				let rawTransaction = await rpc.getRawTransaction(transaction.hashHex, 1);

				//
				debug.timer2("RPC: getRawTransaction");

				// Initialize control parameters to measure OP_RETURN outputs.
				let opReturnCount = 0;
				let opReturnIndex = null;

				// Go over each output in the transction and ..
				for(outputIndex in rawTransaction.vout)
				{
					// Copy output to a local variable for legibility.
					let currentOuput = rawTransaction.vout[outputIndex];

					// Check if this output starts with an OP_RETURN opcode.
					if(currentOuput.scriptPubKey.hex.startsWith('6a'))
					{
						// Increase the counter and store a link to this output.
						opReturnCount += 1;
						opReturnIndex = outputIndex;
					}
				}

				//
				debug.timer2("NJS: Evaluated outputs for OP_RETURN");

				// 2a) Validate that there exist at least one OP_RETURN output.
				if(opReturnCount == 0)
				{
					debug.silent('Discarding [' + transaction.hashHex + ']: Missing OP_RETURN output.');
					continue;
				}

				// 2b) Validating that there exist no more than a single OP_RETURN output.
				if(opReturnCount > 1)
				{
					debug.action('Discarding [' + transaction.hashHex + ']: Multiple OP_RETURN outputs.');
					continue;
				}

				// 3a) Validating that it has a protocol identifier
				if(!rawTransaction.vout[opReturnIndex].scriptPubKey.hex.startsWith('6a0401010101'))
				{
					debug.silent('Discarding [' + transaction.hashHex + ']: Invalid protocol identifier.');
					continue;
				}

				// If configured to store transaction body and inclusion proofs..
				if(config.server.storage >= 2)
				{
					// Store the transaction data.
					transaction.body = Buffer.from(rawTransaction.hex, 'hex');

					// Get the transaction inclusion proof.
					let rawOutputProof = await rpc.getTxoutProof([ transaction.hashHex ], block.hashHex);

					// Store the inclusion proof on the transaction.
					transaction.proof = Buffer.from(rawOutputProof, 'hex');
				}

				// Store the remainder of the transaction hex, after discarding the OP_RETURN and PROTOCOL IdENTIFIER push.
				let registration = Buffer.from(rawTransaction.vout[opReturnIndex].scriptPubKey.hex, 'hex').slice(6);
				let registrationParts = [];

				//
				debug.timer2("-");

				// While there is still data in the output..
				while(registration.length > 1)
				{
					// Initialize default push and drop lengths.
					let pushLength = 0;
					let dropLength = 1;

					// Read the current opCode.
					let opCode = registration.readUInt8(0);

					// Determine the length of the pushed data and control codes.
					if(opCode <= 75) { pushLength = opCode; }
					if(opCode == 76) { pushLength = registration.readUInt8(1);    dropLength += 1; }
					if(opCode == 77) { pushLength = registration.readUInt16BE(1); dropLength += 2; }
					if(opCode == 78) { pushLength = registration.readUInt32BE(1); dropLength += 4; }

					// Remove the control codes.
					registration = registration.slice(dropLength);

					// Read and remove the pushlength if more than 0.
					if(pushLength > 0)
					{
						// Push the value to the parts array.
						registrationParts.push(registration.slice(0, pushLength));

						// Remove the value data.
						registration = registration.slice(pushLength);
					}
				}

				//
				debug.timer2("NJS: Parsed OP_RETURN structure");

				// Store the transaction so we can reference it in validity status.
				queries.storeTransaction.run(transaction);

				// Fetch the transaction ID.
				transaction.transactionId = queries.getTransactionByHash.get(transaction).transaction_id;

				// Link transaction to block.
				queries.linkBlockTransaction.run({ ...block, ...transaction });

				//
				debug.timer2("SQL: storeTransaction + getTransactionByHash");

				// Initilalize an empty account object.
				let account = {};

				// Decode the account name and number.
				account.name = registrationParts[0].toString();
				account.number = block.height - protocol.blockModifier;

				// Store the transaction on the account for future reference.
				account.transaction = transaction;

				// 3b) Validating that it has a valid account name.
				if(!protocol.nameRegexp.test(account.name))
				{
					// Log into the database why this registration is invalid.
					queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: protocol.errors.INVALID_NAME} });

					debug.action('Discarding [' + transaction.hashHex + ']: Invalid account name.');
					continue;
				}

				// 4a) Validating that there exist at least one payload information
				if(registrationParts.length <= 1)
				{
					// Log into the database why this registration is invalid.
					queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: protocol.errors.MISSING_PAYLOAD} });

					debug.action('Discarding [' + transaction.hashHex + ']: Missing payload information.');
					continue;
				}

				account.payloads = [];

				let payloadIndex = 0;
				while(++payloadIndex < registrationParts.length)
				{
					let payload =
					{
						type: registrationParts[payloadIndex].readUInt8(0),
						name: null,
						data: registrationParts[payloadIndex].slice(1),
						address: null
					};

					// If this is a known payload type..
					if(typeof protocol.payloadTypes[payload.type] !== 'undefined')
					{
						payload.name = protocol.payloadTypes[payload.type].name;

						// 4b) Validate length of known payload data.
						if(payload.data.length != protocol.payloadTypes[payload.type].length)
						{
							// Log into the database why this registration is invalid.
							queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: protocol.errors.INVALID_PAYLOAD_LENGTH} });

							debug.action('Ignoring [' + transaction.hashHex + '] Payment [' + payloadIndex + ']: Invalid payload length.');
							continue;
						}

						// 4c) decode structure of known payload data.
						switch(payload.type)
						{
							// Type: Key Hash
							case 1:
							{
								payload.address = new bch.Address(payload.data, 'livenet', 'pubkeyhash').toCashAddress();
								break;
							}
							// Type: Script Hash
							case 2:
							{
								payload.address = new bch.Address(payload.data, 'livenet', 'scripthash').toCashAddress();
								break;
							}
							// Type: Payment Code
							case 3:
							{
								payload.address = bch.encoding.Base58Check.encode(payload.data);
								break;
							}
							// Type: Stealth Keys
							case 4:
							{
							}
						}
					}

					// Store this payload in the account.
					account.payloads.push(payload);
				}

				// Store this account in the block.
				block.accounts.push(account);

				debug.action("Valid registration [" + transaction.hashHex + "]");
				debug.object(account);
			}
			catch(error)
			{
				console.log('Parsing failed:', error);
				process.exit();
			}
		}

		//
		debug.timer1("Completed parsing block");
		debug.timer2("Starting to handle registrations");

		// Validation and processing of the block is complete, time to store the data into the database.
		{
			// Calculate collision information.
			{
				debug.timer4("Begin collisions calculation.");

				// Set up a collision table.
				let collisionTable = {};

				debug.timer4("Populate collision table.");

				// Populate the collision table.
				for(accountIndex in block.accounts)
				{
					// Local copy for code legibility.
					let account = block.accounts[accountIndex];
					let accountIdentity = calculateAccountIdentity(block.hash, account.transaction.hash);

					block.accounts[accountIndex].collisionHash = accountIdentity.collisionHash;
					block.accounts[accountIndex].emoji = String.fromCodePoint(accountIdentity.accountEmoji);

					// Add this collision to the collision list for this name at this blockheight.
					deepSet(collisionTable)[account.name.toLowerCase()][accountIdentity.collisionHash] = accountIdentity.collisionHash;
				}

				debug.timer4("Calculate shortest identifier.");

				// Calculate the shortest identifiers.
				for(accountIndex in block.accounts)
				{
					// Local copy for code legibility.
					let account = block.accounts[accountIndex];

					// Make temporary copies for code legibility reasons.
					let collisionMinimal = 0;
					
					// For each collision registered to this name and blockheight..
					for(collisionIndex in collisionTable[account.name.toLowerCase()])
					{
						// Make a temporary copy for code legibility reasons.
						let currentCollision = collisionTable[account.name.toLowerCase()][collisionIndex];

						// Start at collision length of 10 and work backwards until we discover the shortest collision..
						let length = 10;
						while(length > collisionMinimal)
						{
							// .. but only compare with actual collisions, not with ourselves.
							if(account.collisionHash != currentCollision)
							{
								// If this collision is the same from the start up to this tested collision length..
								if(account.collisionHash.substring(0, length) == currentCollision.substring(0, length))
								{
									// .. and since this is the first full collision, break and move on with this collision length.
									break;
								}
							}

							// Retry with a shorter collision length.
							length -= 1;
						}

						// Store the length of the longest collision.
						collisionMinimal = length;
					}

					// If there was at least one collision..
					if(Object.keys(collisionTable[account.name.toLowerCase()]).length > 1)
					{
						// Store the collision metadata.
						block.accounts[accountIndex].collisionCount = Object.keys(collisionTable[account.name.toLowerCase()]).length;
						block.accounts[accountIndex].collisionLength = collisionMinimal + 1;
					}
					else
					{
						// Store the collision metadata.
						block.accounts[accountIndex].collisionCount = 0
						block.accounts[accountIndex].collisionLength = 0;
					}
				}
				debug.timer4("Completed collision calculation");
			}

			try
			{
				// 
				for(accountIndex in block.accounts)
				{
					// Local copy for code legibility.
					let account = block.accounts[accountIndex];

					debug.timer5("Starting to store account.");

					sql.exec('BEGIN TRANSACTION');
					
					// Store the account and account name
					{
						// Store the account name
						queries.storeName.run(account);

						// Fetch the account name ID.
						account.nameId = queries.getName.get(account).name_id;

						// Store the account
						queries.storeAccount.run({ ...account, ...account.transaction });

						// Fetch the account ID.
						account.accountId = queries.getAccountByTransactionId.get(account.transaction).account_id;
					}

					// Store the account payloads.
					for(payloadIndex in account.payloads)
					{
						// Store the account payload
						queries.storePayload.run(account.payloads[payloadIndex]);

						// Fetch the payload ID.
						account.payloads[payloadIndex].payloadId = queries.getPayload.get(account.payloads[payloadIndex]).payload_id;

						// Link the account payload to the account
						queries.linkAccountPayload.run({ ...account, ...account.payloads[payloadIndex] })
					}

					sql.exec('COMMIT TRANSACTION');

					debug.timer5("Completed storing account.");

					//
					debug.result("Stored registration (" + account.emoji + ") " + account.name + "#" + account.number + "." + account.collisionHash);
				}
			}
			catch(error)
			{
				console.log('Storing failed:', error);
				process.exit();
			}
		}

		//
		debug.timer2("Completed handling registrations");

		// Update chaintip
		queries.updateChainTip.run({ chain_tip: block.height });
		
		// Update service status
		queries.updateServiceStatus.run({ chain_tip: block.height });
	}

	parserState = false;
	debug.timer6('Completed parsing new block(s).');
	try
	{
		return res.status(200).json(null);
	}
	catch(error)
	{
		return null;
	}
};

// Enable support for Express apps
const express = require('express');
const router = express.Router();

// Call parseBlock when this route is requested.
router.get('/', parseBlock);

// ...
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

// Parse blocks once on startup.
parseBlock(null, null);

module.exports = router;
