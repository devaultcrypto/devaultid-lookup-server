// Enable support for Express apps
const express = require('express');
const router = express.Router();

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

// Set initial parsing state.
var parserState = null;

// Wrap the parsing function in an async function.
const parseBlock = async function (req, res)
{
	req.app.locals.debug.timer6('Got notified of new block(s).');

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
		let getServiceStatusResult = req.app.locals.queries.getServiceStatus.get();

		//
		req.app.locals.debug.struct('Loaded indexing service state.');
		req.app.locals.debug.object(getServiceStatusResult);

		req.app.locals.debug.timer1("Starting to parse block");
		req.app.locals.debug.timer2("-");

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

		try
		{
			// Request the current blocks hash from the RPC node.
			let getBlockHashResult = await req.app.locals.rpc.getBlockHash(block.height);

			//
			req.app.locals.debug.timer2("RPC: getBlockHash");
			req.app.locals.debug.object(getBlockHashResult);

			// Check if the block was valid.
			if(typeof getBlockHashResult != 'string')
			{
				// If the block cannot be found due to not being indexed by full node yet..
				if(getBlockHashResult.error.code == -8)
				{
					//
					req.app.locals.debug.silent('Requested a block height that does not yet exist.');

					// break the while loop.
					break;
				}
			}

			// Store the block hash a hex string and buffer.
			block.hashHex = getBlockHashResult;
			block.hash = Buffer.from(block.hashHex, 'hex');

			// Store the block in the database (if necessary)
			req.app.locals.queries.storeBlock.run(block);

			//
			req.app.locals.debug.timer2("SQL: storeBlock");
			req.app.locals.debug.object(block);

			// Link the block to its parent.
			req.app.locals.queries.linkBlock.run(block);

			//
			req.app.locals.debug.timer2("SQL: linkBlock");
			req.app.locals.debug.object(block);

			let newBlock = await req.app.locals.rpc.getBlock(block.hashHex, true, true);

			//
			req.app.locals.debug.blocks('Parsing block #' + block.height + ' [' + block.hashHex + ']');
			req.app.locals.debug.object(newBlock);

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
				req.app.locals.debug.struct("Transaction [" + transaction.hashHex + "]");
				req.app.locals.debug.timer2("-");

				try
				{
					// Get the raw transaction.
					let rawTransaction = await req.app.locals.rpc.getRawTransaction(transaction.hashHex, 1);

					//
					req.app.locals.debug.timer2("RPC: getRawTransaction");

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
					req.app.locals.debug.timer2("NJS: Evaluated outputs for OP_RETURN");

					// 2a) Validate that there exist at least one OP_RETURN output.
					if(opReturnCount == 0)
					{
						req.app.locals.debug.silent('Discarding [' + transaction.hashHex + ']: Missing OP_RETURN output.');
						continue;
					}

					// 2b) Validating that there exist no more than a single OP_RETURN output.
					if(opReturnCount > 1)
					{
						req.app.locals.debug.action('Discarding [' + transaction.hashHex + ']: Multiple OP_RETURN outputs.');
						continue;
					}

					// 3a) Validating that it has a protocol identifier
					if(!rawTransaction.vout[opReturnIndex].scriptPubKey.hex.startsWith('6a0401010101'))
					{
						req.app.locals.debug.silent('Discarding [' + transaction.hashHex + ']: Invalid protocol identifier.');
						continue;
					}

					// If configured to store transaction body and inclusion proofs..
					if(req.app.locals.config.server.storage >= 2)
					{
						// Store the transaction data.
						transaction.body = Buffer.from(rawTransaction.hex, 'hex');

						// Get the transaction inclusion proof.
						let rawOutputProof = await req.app.locals.rpc.getTxoutProof([ transaction.hashHex ], block.hashHex);

						// Store the inclusion proof on the transaction.
						transaction.proof = Buffer.from(rawOutputProof, 'hex');
					}

					// Store the remainder of the transaction hex, after discarding the OP_RETURN and PROTOCOL IdENTIFIER push.
					let registration = Buffer.from(rawTransaction.vout[opReturnIndex].scriptPubKey.hex, 'hex').slice(6);
					let registrationParts = [];

					//
					req.app.locals.debug.timer2("-");

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
					req.app.locals.debug.timer2("NJS: Parsed OP_RETURN structure");

					// Store the transaction so we can reference it in validity status.
					req.app.locals.queries.storeTransaction.run(transaction);

					// Fetch the transaction ID.
					transaction.transactionId = req.app.locals.queries.getTransactionByHash.get(transaction).transaction_id;

					// Link transaction to block.
					req.app.locals.queries.linkBlockTransaction.run({ ...block, ...transaction });

					//
					req.app.locals.debug.timer2("SQL: storeTransaction + getTransactionByHash");

					// Initilalize an empty account object.
					let account = {};

					// Decode the account name and number.
					account.name = registrationParts[0].toString();
					account.number = block.height - req.app.locals.protocol.blockModifier;

					// Store the transaction on the account for future reference.
					account.transaction = transaction;

					// 3b) Validating that it has a valid account name.
					if(!req.app.locals.protocol.nameRegexp.test(account.name))
					{
						// Log into the database why this registration is invalid.
						req.app.locals.queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: req.app.locals.protocol.errors.INVALID_NAME} });

						req.app.locals.debug.action('Discarding [' + transaction.hashHex + ']: Invalid account name.');
						continue;
					}

					// 4a) Validating that there exist at least one payload information
					if(registrationParts.length <= 1)
					{
						// Log into the database why this registration is invalid.
						req.app.locals.queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: req.app.locals.protocol.errors.MISSING_PAYLOAD} });

						req.app.locals.debug.action('Discarding [' + transaction.hashHex + ']: Missing payload information.');
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
						if(typeof req.app.locals.protocol.payloadTypes[payload.type] !== 'undefined')
						{
							payload.name = req.app.locals.protocol.payloadTypes[payload.type].name;

							// 4b) Validate length of known payload data.
							if(payload.data.length != req.app.locals.protocol.payloadTypes[payload.type].length)
							{
								// Log into the database why this registration is invalid.
								req.app.locals.queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: req.app.locals.protocol.errors.INVALID_PAYLOAD_LENGTH} });

								req.app.locals.debug.action('Ignoring [' + transaction.hashHex + '] Payment [' + payloadIndex + ']: Invalid payload length.');
								continue;
							}

							// 4c) decode structure of known payload data.
							switch(payload.type)
							{
								// Type: Key Hash
								case 1:
								{
									payload.address = new req.app.locals.bch.Address(payload.data, 'livenet', 'pubkeyhash').toCashAddress();
									break;
								}
								// Type: Script Hash
								case 2:
								{
									payload.address = new req.app.locals.bch.Address(payload.data, 'livenet', 'scripthash').toCashAddress();
									break;
								}
								// Type: Payment Code
								case 3:
								{
									payload.address = req.app.locals.bch.encoding.Base58Check.encode(Buffer.concat([ Buffer.from('47', 'hex'), payload.data ]));
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

					req.app.locals.debug.action("Valid registration [" + transaction.hashHex + "]");
					req.app.locals.debug.object(account);
				}
				catch(error)
				{
					console.log('Parsing failed:', error);
					process.exit();
				}
			}
		}
		catch(error)
		{
			//console.log('Could not get block:', error);
			break;
		}

		//
		req.app.locals.debug.timer1("Completed parsing block");
		req.app.locals.debug.timer2("Starting to handle registrations");

		// Validation and processing of the block is complete, time to store the data into the database.
		{
			// Calculate collision information.
			{
				req.app.locals.debug.timer4("Begin collisions calculation.");

				// Set up a collision table.
				let collisionTable = {};

				req.app.locals.debug.timer4("Populate collision table.");

				// Populate the collision table.
				for(accountIndex in block.accounts)
				{
					// Local copy for code legibility.
					let account = block.accounts[accountIndex];
					let accountIdentity = req.app.locals.protocol.calculateAccountIdentity(block.hash, account.transaction.hash);

					block.accounts[accountIndex].collisionHash = accountIdentity.collisionHash;
					block.accounts[accountIndex].emoji = String.fromCodePoint(accountIdentity.accountEmoji);

					// Add this collision to the collision list for this name at this blockheight.
					deepSet(collisionTable)[account.name.toLowerCase()][accountIdentity.collisionHash] = accountIdentity.collisionHash;
				}

				req.app.locals.debug.timer4("Calculate shortest identifier.");

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

				req.app.locals.debug.timer4("Completed collision calculation");
			}

			try
			{
				// 
				for(accountIndex in block.accounts)
				{
					// Local copy for code legibility.
					let account = block.accounts[accountIndex];

					req.app.locals.debug.timer5("Starting to store account.");

					req.app.locals.sql.exec('BEGIN TRANSACTION');
					
					// Store the account and account name
					{
						// Store the account name
						req.app.locals.queries.storeName.run(account);

						// Fetch the account name ID.
						account.nameId = req.app.locals.queries.getName.get(account).name_id;

						// Store the account
						req.app.locals.queries.storeAccount.run({ ...account, ...account.transaction });

						// Fetch the account ID.
						account.accountId = req.app.locals.queries.getAccountByTransactionId.get(account.transaction).account_id;
					}

					// Store the account payloads.
					for(payloadIndex in account.payloads)
					{
						// Store the account payload
						req.app.locals.queries.storePayload.run(account.payloads[payloadIndex]);

						// Fetch the payload ID.
						account.payloads[payloadIndex].payloadId = req.app.locals.queries.getPayload.get(account.payloads[payloadIndex]).payload_id;

						// Link the account payload to the account
						req.app.locals.queries.linkAccountPayload.run({ ...account, ...account.payloads[payloadIndex] })
					}

					req.app.locals.sql.exec('COMMIT TRANSACTION');

					req.app.locals.debug.timer5("Completed storing account.");

					//
					req.app.locals.debug.result("Stored registration (" + account.emoji + ") " + account.name + "#" + account.number + "." + account.collisionHash);
				}
			}
			catch(error)
			{
				console.log('Storing failed:', error);
				process.exit();
			}
		}

		//
		req.app.locals.debug.timer2("Completed handling registrations");

		// Update chaintip
		req.app.locals.queries.updateChainTip.run({ chain_tip: block.height });
		
		// Update service status
		req.app.locals.queries.updateServiceStatus.run({ chain_tip: block.height });
	}

	parserState = false;
	req.app.locals.debug.timer6('Completed parsing new block(s).');
	try
	{
		return res.status(200).json(null);
	}
	catch(error)
	{
		return null;
	}
};

// Call parseBlock when this route is requested.
router.get('/', parseBlock);

module.exports = router;
