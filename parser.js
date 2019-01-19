// Enable support for configurable debugging.
const debug =
{
	struct: require('debug')('calus:struct'),
	status: require('debug')('calus:status'),
	action: require('debug')('calus:action'),
	object: require('debug')('calus:object'),
	silent: require('debug')('calus:silent'),
}

// Issue an initial debug message so we can measure loading times.
debug.struct('Started application.');

// Read the configuration file.
const config = require("./config.js");

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

// 
debug.struct('Loaded dependencies.');

//
const rpc = new bchRPC(config.node.address, config.node.user, config.node.pass, config.node.port, 5000);

debug.status('Connected to RPC node');

// Open the database in read-write mode.
const sql = new Database(config.storage.filename, { memory: false, readonly: false });

// 
debug.status('Opened database.');

// Enable support for foreign keys.
sql.pragma('foreign_keys = ON');

// Load the available database queries.
const queries =
{
	// Block related queries.
	getBlockByHash:				filesystem.readFileSync('sql/query_get_block_by_hash.sql', 'utf8').trim(),
	storeBlock:					filesystem.readFileSync('sql/query_store_block.sql', 'utf8').trim(),
	linkBlock:					filesystem.readFileSync('sql/query_link_block.sql', 'utf8').trim(),

	// Transaction related queries.
	storeTransaction:			filesystem.readFileSync('sql/query_store_transaction.sql', 'utf8').trim(),
	storeTransactionData:		filesystem.readFileSync('sql/query_store_transaction_data.sql', 'utf8').trim(),
	getTransactionByHash:		filesystem.readFileSync('sql/query_get_transaction_by_hash.sql', 'utf8').trim(),

	// Payload related queries.
	getPayload:					filesystem.readFileSync('sql/query_get_payload.sql', 'utf8').trim(),
	storePayload:				filesystem.readFileSync('sql/query_store_payload.sql', 'utf8').trim(),
	linkAccountPayload:			filesystem.readFileSync('sql/query_link_account_payload.sql', 'utf8').trim(),

	// Account related queries.
	storeAccount:				filesystem.readFileSync('sql/query_store_account.sql', 'utf8').trim(),
	getAccountByTransactionId:	filesystem.readFileSync('sql/query_get_account_by_transaction_id.sql', 'utf8').trim(),
	storeAccountName:			filesystem.readFileSync('sql/query_store_account_name.sql', 'utf8').trim(),
	getAccountName:				filesystem.readFileSync('sql/query_get_account_name.sql', 'utf8').trim(),

	// Other queries.
	invalidateRegistration:		filesystem.readFileSync('sql/query_invalidate_registration.sql', 'utf8').trim(),
	getServiceStatus:			filesystem.readFileSync('sql/query_get_service_status.sql', 'utf8').trim(),
	updateServiceStatus:		filesystem.readFileSync('sql/query_update_service_status.sql', 'utf8').trim(),
	updateChainTip:				filesystem.readFileSync('sql/query_update_chain_tip.sql', 'utf8').trim(),
}

// Load the database schema.
const databaseSchema = filesystem.readFileSync('sql/database_schema.sql', 'utf8').trim();

// Create the database schema.
sql.exec(databaseSchema);

// 
debug.struct('Initialized database schema.');

const registration_errors =
{
	
	
	
}

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
		EMPTY_PAYLOAD: 3,
		INVALID_PAYLOAD_LENGTH: 4
	}
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
	let iterations = 3000;
	while(iterations--)
	{
		// Find a blockheight to request.
		let getServiceStatusResult = sql.prepare(queries.getServiceStatus).get();

		//
		debug.struct('Loaded indexing service state.');
		debug.status('Current chain tip: #' + getServiceStatusResult.block_height);
		debug.object(getServiceStatusResult);

		// Initialize an empty block object.
		let block = {};

		// Store information on the parent block.
		block.parentHash = getServiceStatusResult.block_hash;
		block.parentHeight = getServiceStatusResult.block_height;

		// Store information on the current block.
		block.height = getServiceStatusResult.block_height + 1;

		// Request the current blocks hash from the RPC node.
		block.hashHex = await rpc.getBlockHash(block.height);
		block.hash = Buffer.from(block.hashHex, 'hex');

		// Store the block in the database (if necessary)
		sql.prepare(queries.storeBlock).run(block);

		// Load the block and its parent from the database.
		let getCurrentBlockResult = sql.prepare(queries.getBlockByHash).get({ hash: block.hash });
		let getParentBlockResult = sql.prepare(queries.getBlockByHash).get({ hash: block.parentHash });

		// Store the block and parent id from the database.
		block.block_id = getCurrentBlockResult.block_id;
		block.parent_id = getParentBlockResult.block_id;

		// Link the block to its parent.
		sql.prepare(queries.linkBlock).run({ block: block.block_id, parent: block.parent_id });

		let newBlock = await rpc.getBlock(block.hashHex, true, true);
		let transactionList = newBlock.tx;

		//
		debug.struct('Parsing block #' + block.height + ' [' + block.hashHex + ']:', "\n");

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

			//
			debug.struct("Parsing transaction [" + transaction.hashHex + "]");

			try
			{
				// Get the raw transaction.
				let rawTransaction = await rpc.getRawTransaction(transaction.hashHex, 1);

				// Store the transaction data.
				transaction.data = Buffer.from(rawTransaction.hex, 'hex');

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

				// Store the remainder of the transaction hex, after discarding the OP_RETURN and PROTOCOL IdENTIFIER push.
				let registration = Buffer.from(rawTransaction.vout[opReturnIndex].scriptPubKey.hex, 'hex').slice(6);
				let registrationParts = [];

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
					if(opCode == 76) { pushLength = registration.readUInt8(0);    dropLength += 1; }
					if(opCode == 77) { pushLength = registration.readUInt16BE(0); dropLength += 2; }
					if(opCode == 78) { pushLength = registration.readUInt32BE(0); dropLength += 4; }

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

				// Store the transaction so we can reference it in validity status.
				sql.prepare(queries.storeTransaction).run(transaction);

				// Fetch the transaction ID.
				transaction.transaction_id = sql.prepare(queries.getTransactionByHash).get(transaction).transaction_id;

				// Initilalize an empty account object.
				let account = {};
				let accountIdentity = calculateAccountIdentity(block.hash, transaction.hash);

				account.name = registrationParts[0].toString();
				account.number = block.height - protocol.blockModifier;
				account.hash = accountIdentity.collisionHash;
				account.emoji = String.fromCodePoint(accountIdentity.accountEmoji);

				// 3b) Validating that it has a valid account name.
				if(!protocol.nameRegexp.test(account.name))
				{
					// Log into the database why this registration is invalid.
					sql.prepare(queries.invalidateRegistration).run({ transaction_id: transaction.transaction_id, error_type_id: protocol.errors.INVALID_NAME });

					debug.action('Discarding [' + transaction.hashHex + ']: Invalid account name.');
					continue;
				}

				// 4a) Validating that there exist at least one payload information
				if(registrationParts.length <= 1)
				{
					// Log into the database why this registration is invalid.
					sql.prepare(queries.invalidateRegistration).run({ transaction_id: transaction.transaction_id, error_type_id: protocol.errors.MISSING_PAYLOAD });

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
						name: protocol.payloadTypes[registrationParts[payloadIndex].readUInt8(0)].name,
						data: registrationParts[payloadIndex].slice(1),
						address: null
					};

					// 4b) Validate length of known payload data.
					if(payload.data.length != protocol.payloadTypes[payload.type].length)
					{
						// Log into the database why this registration is invalid.
						sql.prepare(queries.invalidateRegistration).run({ transaction_id: transaction.transaction_id, error_type_id: protocol.errors.INVALID_PAYLOAD_LENGTH });

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

					// Validation and processing is complete, time to store the data into the database.
					{
						// Mode: minimal
						{
							// Store the account name
							sql.prepare(queries.storeAccountName).run(account);

							// Fetch the account name ID.
							account.account_name_id = sql.prepare(queries.getAccountName).get(account).account_name_id;

							// Store the account
							sql.prepare(queries.storeAccount).run({ ...account, ...transaction });

							// Fetch the account ID.
							account.account_id = sql.prepare(queries.getAccountByTransactionId).get(transaction).account_id;
						}

						// Mode: default
						if(false)
						{
							// Get the transaction inclusion proof.
							let rawOutputProof = await rpc.getTxOutProof(transaction.hashHex);

							// Store the inclusion proof on the transaction.
							transaction.proof = Buffer.from(rawOutputProof, 'hex');

							// Store the transaction data and inclusion proof
							sql.prepare(queries.storeTransactionData).run(transaction);
						}

						// Mode: extended
						if(true)
						{
							// Store the account metadata
							//sql.prepare(queries.storeAccountMetadata).run(account);

							// Store the account payload
							sql.prepare(queries.storePayload).run(payload);

							// Fetch the payload ID.
							payload.payload_id = sql.prepare(queries.getPayload).get(payload).payload_id;

							// Link the account payload to the account
							sql.prepare(queries.linkAccountPayload).run({ ...account, ...payload })
						}
					}

					account.payloads.push(payload);
				}

				debug.status("Decoded registration (" + account.emoji + ") " + account.name + "#" + account.number + "." + account.hash);
				debug.object(account);
			}
			catch (error)
			{
				console.log(error);
			}
		}

		// Update chaintip
		sql.prepare(queries.updateChainTip).run({ chain_tip: block.block_id });
		
		// Update service status
		sql.prepare(queries.updateServiceStatus).run({ chain_tip: block.block_id });
	}
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
