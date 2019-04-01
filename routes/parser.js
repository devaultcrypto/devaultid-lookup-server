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
	//
	req.app.locals.debug.struct('Received notification of new block(s).');

	// Check if we are already processing transactions..
	if(parserState)
	{
		//
		req.app.locals.debug.struct('Ignoring notification of new block(s) due to already processing blocks.');

		// .. return 200 OK and let the current thread continue without interference.
		return res.status(200).json(null);
	}
	else
	{
		// .. set parser state to active to indicate that we are now processing new block(s).
		parserState = true;
	}

	// Set up a timer to measure how long time it takes to complete parsing.
	req.app.locals.debug.timers("-");

	//
	counters = 
	{
		blocks: 0,
		transactions: 0,
		inclusion_proofs: 0,
		rpc_calls: 0,
		sql_queries: 0,
	};

	// Configure how many blocks to parse in a row by default.
	let iterations = 123456789;

	// Until we have parsed as many blocks as requested..
	while(iterations--)
	{
		//
		req.app.locals.debug.struct('Loading indexing service state from database.');

		// Find a blockheight to request.
		let getServiceStatusResult = req.app.locals.queries.getServiceStatus.get();
		counters.sql_queries += 1;

		//
		req.app.locals.debug.struct('Loaded indexing service state.');
		req.app.locals.debug.object(getServiceStatusResult);

		// Initialize an empty block object.
		let block = 
		{
			blockHash: null,
			blockHashHex: null,
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
			//
			req.app.locals.debug.silent("Requesting blockhash for block height: " + block.height);

			// Request the current blocks hash from the RPC node.
			let getBlockHashResult = await req.app.locals.rpc('getBlockHash', block.height);
			counters.rpc_calls += 1;

			// Check if the block was valid.
			if(typeof getBlockHashResult == 'undefined')
			{
				//
				req.app.locals.debug.silent('Requested block height is not available.');

				// break the while loop.
				break;
			}

			//
			req.app.locals.debug.silent("Received blockhash reply from RPC node.");
			req.app.locals.debug.object(getBlockHashResult);

			// Store the block hash a hex string and buffer.
			block.blockHashHex = getBlockHashResult;
			block.blockHash = Buffer.from(block.blockHashHex, 'hex');

			//
			req.app.locals.debug.struct('Storing the block in the database.');

			// Store the block in the database (if necessary)
			req.app.locals.queries.storeBlock.run(block);
			counters.blocks += 1;
			counters.sql_queries += 1;

			//
			req.app.locals.debug.struct('Linking the block to its parent in the database.');

			// Link the block to its parent.
			req.app.locals.queries.linkBlock.run(block);
			counters.sql_queries += 1;

			//
			req.app.locals.debug.struct('Completed storing and linking the block in the database.');
			req.app.locals.debug.object(block);

			// TODO: Remove getBlock when we no longer need it due to getting the raw transaction list directly.
			
			//
			req.app.locals.debug.struct('Requesting block contents from Bitcoin RPC node.');

// Roughly 75~95% of application time is spent getting raw transactions.
req.app.locals.debug.timer9('-');
			let transactionList = [];

			// Try to use the new batch calls in BU.
			try
			{
				transactionList = await req.app.locals.rpc('getRawBlockTransactions', block.blockHashHex, 1);
				counters.rpc_calls += 1;
			}
			// Fall back to old one-at-a-time calls when not available.
			catch (error)
			{
				let newBlock;

				// First try with BUs RPC structure..
				try
				{
					newBlock = await req.app.locals.rpc('getBlock', block.blockHashHex, true, true);
					counters.rpc_calls += 1;
				}
				// If the response is invalid, try with ABCs RPC structure.
				catch (error)
				{
					newBlock = await req.app.locals.rpc('getBlock', block.blockHashHex, true);
					counters.rpc_calls += 1;
				}
				
				for(txIndex in newBlock.tx)
				{
					// Get the raw transaction.
					let rawTransaction = await req.app.locals.rpc('getRawTransaction', newBlock.tx[txIndex], 1);
					counters.rpc_calls += 1;

					transactionList.push(rawTransaction);
				}
			}
req.app.locals.debug.timer9('Finished getting raw transactions.');

			//
			req.app.locals.debug.struct('Received block contents from Bitcoin RPC node.');
			req.app.locals.debug.blocks('Parsing block #' + block.height + ' [' + block.blockHashHex + ']');
			req.app.locals.debug.object(transactionList);


			/*
			* 1) To register a Cash Account you broadcast a Bitcoin Cash transaction 
			* 2) with a single OP_RETURN output in any position, 
			* 3) containing a Protocol Identifier, an Account Name and 
			* 4) one or more Payment Data.
			*/

			let transactionParsers = [];

			// 1) Validating that there is a mined (and therefor broadcasted) registration transaction
			for(transactionIndex in transactionList)
			{
				try
				{
					transactionParsers.push
					(
						new Promise(
							function(resolve, reject)
							{
								// Initialize an empty transaction object.
								let transaction = {};

								// Copy transaction hash locally for legibility.
								transaction.transactionHashHex = transactionList[transactionIndex].txid;
								transaction.transactionHash = Buffer.from(transaction.transactionHashHex, 'hex');

								// Initialize empty values for the transaction body and proof.
								transaction.proof = null;
								transaction.body = null;

								//
								req.app.locals.debug.struct("Transaction [" + transaction.transactionHashHex + "]");
								counters.transactions += 1;

								try
								{
									// Initialize control parameters to measure OP_RETURN outputs.
									let opReturnCount = 0;
									let opReturnIndex = null;

									// Go over each output in the transction and ..
									for(outputIndex in transactionList[transactionIndex].vout)
									{
										// Copy output to a local variable for legibility.
										let currentOuput = transactionList[transactionIndex].vout[outputIndex];

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
										req.app.locals.debug.silent('Discarding [' + transaction.transactionHashHex + ']: Missing OP_RETURN output.');
										return resolve(false);
									}

									// 2b) Validating that there exist no more than a single OP_RETURN output.
									if(opReturnCount > 1)
									{
										req.app.locals.debug.action('Discarding [' + transaction.transactionHashHex + ']: Multiple OP_RETURN outputs.');
										return resolve(false);
									}

									// 3a) Validating that it has a protocol identifier
									if(!transactionList[transactionIndex].vout[opReturnIndex].scriptPubKey.hex.startsWith('6a0401010101'))
									{
										req.app.locals.debug.silent('Discarding [' + transaction.transactionHashHex + ']: Invalid protocol identifier.');
										return resolve(false);
									}

									// Store the remainder of the transaction hex, after discarding the OP_RETURN and PROTOCOL IdENTIFIER push.
									let registration = Buffer.from(transactionList[transactionIndex].vout[opReturnIndex].scriptPubKey.hex, 'hex').slice(6);
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
										req.app.locals.queries.storeTransaction.run(transaction);
										req.app.locals.queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: req.app.locals.protocol.errors.INVALID_NAME} });
										counters.sql_queries += 2;

										req.app.locals.debug.action('Discarding [' + transaction.transactionHashHex + ']: Invalid account name.');
										return resolve(false);
									}

									// 4a) Validating that there exist at least one payload information
									if(registrationParts.length <= 1)
									{
										// Log into the database why this registration is invalid.
										req.app.locals.queries.storeTransaction.run(transaction);
										req.app.locals.queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: req.app.locals.protocol.errors.MISSING_PAYLOAD} });
										counters.sql_queries += 2;

										req.app.locals.debug.action('Discarding [' + transaction.transactionHashHex + ']: Missing payload information.');
										return resolve(false);
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
												req.app.locals.queries.storeTransaction.run(transaction);
												req.app.locals.queries.invalidateRegistration.run({ ...transaction, ...{ errorTypeId: req.app.locals.protocol.errors.INVALID_PAYLOAD_LENGTH} });
												counters.sql_queries += 2;

												req.app.locals.debug.action('Ignoring [' + transaction.transactionHashHex + '] Payment [' + payloadIndex + ']: Invalid payload length.');
												return resolve(false);
											}

											// 4c) decode structure of known payload data.
											payload.address = req.app.locals.protocol.parseAddress(payload.type, payload.data);
										}

										// Store this payload in the account.
										account.payloads.push(payload);
									}

									// If configured to store transaction body and inclusion proofs..
									if(req.app.locals.config.server.storage >= 2)
									{
										// Store the transaction data.
										account.transaction.body = Buffer.from(transactionList[transactionIndex].hex, 'hex');
									}

									// Store this account in the block.
									block.accounts.push(account);

									req.app.locals.debug.action("Valid registration [" + transaction.transactionHashHex + "]");
									req.app.locals.debug.object(account);

									//
									return resolve(true);
								}
								catch(error)
								{
									return reject('Parsing failed: ' + error);
								}
							}
						)
					);
				}
				catch(error)
				{
					console.log(error);
					continue;
				}
			}

			// Wait until all transactions have been parsed.
			await Promise.all(transactionParsers);
		}
		catch(error)
		{
			// console.log('Could not get block:', error);
			break;
		}

		//
		req.app.locals.debug.timer1("Completed parsing block");
		req.app.locals.debug.timer2("Starting to handle registrations");

		// Validation and processing of the block is complete, time to store the data into the 
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
					let accountIdentity = req.app.locals.protocol.calculateAccountIdentity(block.blockHash, account.transaction.transactionHash);

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
				// Store all transactions
				{
					req.app.locals.debug.timer9("-");
					// If configured to store transaction body and inclusion proofs..
					if(req.app.locals.config.server.storage >= 2)
					{
						// Try to use the new batch calls in BU..
						try
						{
							let proofList = [];
							for(accountIndex in block.accounts)
							{
								proofList.push(block.accounts[accountIndex].transaction.transactionHashHex);
							}

							// Get the transaction inclusion proof.
							let rawOutputProof = await req.app.locals.rpc('getTxOutProofs', proofList, block.blockHashHex);
							counters.rpc_calls += 1;

							for(accountIndex in block.accounts)
							{
								// Store the inclusion proof on the transaction.
								block.accounts[accountIndex].transaction.proof = Buffer.from(rawOutputProof, 'hex');
								counters.inclusion_proofs += 1;
							}
						}
						// Fall back to one-by-one calls.
						catch (error)
						{
							for(accountIndex in block.accounts)
							{
								// Get the transaction inclusion proof.
								let rawOutputProof = await req.app.locals.rpc('getTxOutProof', [block.accounts[accountIndex].transaction.transactionHashHex], block.blockHashHex);
								counters.rpc_calls += 1;
								counters.inclusion_proofs += 1;

								// Store the inclusion proof on the transaction.
								block.accounts[accountIndex].transaction.proof = Buffer.from(rawOutputProof, 'hex');
							}
						}
					}
					req.app.locals.debug.timer9("Aquired transaction proofs.");

					req.app.locals.sql.exec('BEGIN TRANSACTION');
					for(accountIndex in block.accounts)
					{
						// Store the transaction so we can reference it in validity status.
						req.app.locals.queries.storeTransaction.run(block.accounts[accountIndex].transaction);
						counters.sql_queries += 1;

						// Link transaction to block.
						req.app.locals.queries.linkBlockTransaction.run({ ...block, ...block.accounts[accountIndex].transaction });
						counters.sql_queries += 1;
					}
					req.app.locals.sql.exec('COMMIT TRANSACTION');
				}

				// Store all names
				{
					req.app.locals.sql.exec('BEGIN TRANSACTION');
					for(accountIndex in block.accounts)
					{
						// Store the account name
						req.app.locals.queries.storeName.run(block.accounts[accountIndex]);
						counters.sql_queries += 1;

					}
					req.app.locals.sql.exec('COMMIT TRANSACTION');
				}

				// Store all payloads
				{
					req.app.locals.sql.exec('BEGIN TRANSACTION');
					for(accountIndex in block.accounts)
					{

						// Store the account payloads.
						for(payloadIndex in block.accounts[accountIndex].payloads)
						{
							// Store the account payload
							req.app.locals.queries.storePayload.run(block.accounts[accountIndex].payloads[payloadIndex]);
							counters.sql_queries += 1;
						}
					}
					req.app.locals.sql.exec('COMMIT TRANSACTION');
				}

				// Store all accounts.
				{
					req.app.locals.sql.exec('BEGIN TRANSACTION');
					for(accountIndex in block.accounts)
					{
						// Store the account
						req.app.locals.queries.storeAccount.run({ ...block.accounts[accountIndex], ...block.accounts[accountIndex].transaction });
						counters.sql_queries += 1;
					}
					req.app.locals.sql.exec('COMMIT TRANSACTION');
				}

				// Link payloads to accounts.
				{
					req.app.locals.sql.exec('BEGIN TRANSACTION');
					for(accountIndex in block.accounts)
					{
						// Link the account payloads
						for(payloadIndex in block.accounts[accountIndex].payloads)
						{
							// Link the account payload to the account
							req.app.locals.queries.linkAccountPayload.run({...block.accounts[accountIndex].transaction, ...block.accounts[accountIndex].payloads[payloadIndex] })
							counters.sql_queries += 1;
						}
					}
					req.app.locals.sql.exec('COMMIT TRANSACTION');
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
		counters.sql_queries += 1;

		// Update service status
		req.app.locals.queries.updateServiceStatus.run({ chain_tip: block.height });
		counters.sql_queries += 1;
	}

	parserState = false;

	// Notify the server admin that we're done parsing new blocks.
	req.app.locals.debug.timers('Completed parsing new block(s).\n', counters);

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

// Parse blocks once on startup.
//parseBlock(null, null);

module.exports = router;
