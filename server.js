// Include support for express applications.
const express = require('express');

// Create an instance of an express application.
const app = express();

// Enable support for filesystem operations.
const filesystem = require('fs');

// Load the configuration file.
app.locals.config = require("./config.js");

// Read the package information file.
app.locals.software = require("./package.json");

// Enable support for configurable debugging.
app.locals.debug =
{
	lookup: require('debug')('calus:lookup'),
	object: require('debug')('calus:object'),
	errors: require('debug')('calus:errors'),
	struct: require('debug')('calus:struct'),
	status: require('debug')('calus:status'),
	blocks: require('debug')('calus:blocks'),
	action: require('debug')('calus:action'),
	result: require('debug')('calus:result'),
	silent: require('debug')('calus:silent'),
	lookup: require('debug')('calus:lookup'),
	object: require('debug')('calus:object'),
	errors: require('debug')('calus:errors'),

	timer1: require('debug')('calus:timer1'),
	timer2: require('debug')('calus:timer2'),
	timer3: require('debug')('calus:timer3'),
	timer4: require('debug')('calus:timer4'),
	timer5: require('debug')('calus:timer5'),
	timer6: require('debug')('calus:timer6'),
}

// Enable lookup messages by default.
app.locals.debug.errors.enabled = true;
app.locals.debug.lookup.enabled = true;
app.locals.debug.status.enabled = true;
app.locals.debug.blocks.enabled = true;
app.locals.debug.result.enabled = true;

//
app.locals.debug.struct('Starting application.');

// Enable the bitcore-lib-cash library functions.
app.locals.bch = require('bitcore-lib-cash');

// Enable RPC connections.
const bitcoinCashRPC = require('bitcoin-cash-rpc');

// Enable support for sqlite databases.
const Database = require('better-sqlite3');

// Open the database in read-write mode.
app.locals.sql = new Database(app.locals.config.server.database, { memory: false, readonly: false });

// Close the database on application exit.
process.on
(
	'beforeExit', 
	function(code)
	{
		console.log('Closing the database.');

		// Close the database.
		app.locals.sql.close();
	}
);


// Enable support for foreign keys.
app.locals.sql.pragma('foreign_keys = ON');

// Use up to 128mb memory as cache.
//app.locals.sql.pragma('cache_size = 32768');

// At the risk of database corruption, don't wait for filesystem.
app.locals.sql.pragma('synchronous = OFF');

// Allow the database to lock the database file on the operating system level.
//app.locals.sql.pragma('locking_mode = EXCLUSIVE');

// Allow the database to keep the journal file when not in use, to prevent re-creating it repeatadly.
app.locals.sql.pragma('journal_mode = TRUNCATE');

// Load the database schema.
const databaseSchema = filesystem.readFileSync('sql/database_schema.sql', 'utf8').trim();

// Create the database schema.
app.locals.sql.exec(databaseSchema);

// Connect to the full node.
app.locals.rpc = new bitcoinCashRPC(app.locals.config.node.address, app.locals.config.node.user, app.locals.config.node.pass, app.locals.config.node.port, 5000, false);

// Load the database queries.
app.locals.queries =
{
	// 
	getStatus:					app.locals.sql.prepare(filesystem.readFileSync('sql/query_get_status.sql', 'utf8').trim()),

	// Registration transaction lookup queries.
	lookupByIdentifier:			app.locals.sql.prepare(filesystem.readFileSync('sql/query_lookup_by_identifier.sql', 'utf8').trim()),
	lookupByName:				app.locals.sql.prepare(filesystem.readFileSync('sql/query_lookup_by_name.sql', 'utf8').trim()),
	lookupByBlock:				app.locals.sql.prepare(filesystem.readFileSync('sql/query_lookup_by_block.sql', 'utf8').trim()),

	// Account metadata lookup queries.
	metadataByBlock:			app.locals.sql.prepare(filesystem.readFileSync('sql/query_metadata_by_block.sql', 'utf8').trim()),
	metadataByName:				app.locals.sql.prepare(filesystem.readFileSync('sql/query_metadata_by_name.sql', 'utf8').trim()),
	metadataByIdentifier:		app.locals.sql.prepare(filesystem.readFileSync('sql/query_metadata_by_identifier.sql', 'utf8').trim()),

	// Block related queries.
	getBlockByHash:				app.locals.sql.prepare(filesystem.readFileSync('sql/query_get_block_by_hash.sql', 'utf8').trim()),
	storeBlock:					app.locals.sql.prepare(filesystem.readFileSync('sql/query_store_block.sql', 'utf8').trim()),
	linkBlock:					app.locals.sql.prepare(filesystem.readFileSync('sql/query_link_block.sql', 'utf8').trim()),

	// Transaction related queries.
	storeTransaction:			app.locals.sql.prepare(filesystem.readFileSync('sql/query_store_transaction.sql', 'utf8').trim()),
	getTransactionByHash:		app.locals.sql.prepare(filesystem.readFileSync('sql/query_get_transaction_by_hash.sql', 'utf8').trim()),
	linkBlockTransaction:		app.locals.sql.prepare(filesystem.readFileSync('sql/query_link_block_transaction.sql', 'utf8').trim()),

	// Payload related queries.
	getPayload:					app.locals.sql.prepare(filesystem.readFileSync('sql/query_get_payload.sql', 'utf8').trim()),
	storePayload:				app.locals.sql.prepare(filesystem.readFileSync('sql/query_store_payload.sql', 'utf8').trim()),
	linkAccountPayload:			app.locals.sql.prepare(filesystem.readFileSync('sql/query_link_account_payload.sql', 'utf8').trim()),

	// Account related queries.
	storeAccount:				app.locals.sql.prepare(filesystem.readFileSync('sql/query_store_account.sql', 'utf8').trim()),
	getAccountByTransactionId:	app.locals.sql.prepare(filesystem.readFileSync('sql/query_get_account_by_transaction_id.sql', 'utf8').trim()),

	//
	storeName:					app.locals.sql.prepare(filesystem.readFileSync('sql/query_store_name.sql', 'utf8').trim()),
	getName:					app.locals.sql.prepare(filesystem.readFileSync('sql/query_get_name.sql', 'utf8').trim()),

	// Other queries.
	invalidateRegistration:		app.locals.sql.prepare(filesystem.readFileSync('sql/query_invalidate_registration.sql', 'utf8').trim()),
	getServiceStatus:			app.locals.sql.prepare(filesystem.readFileSync('sql/query_get_service_status.sql', 'utf8').trim()),
	updateServiceStatus:		app.locals.sql.prepare(filesystem.readFileSync('sql/query_update_service_status.sql', 'utf8').trim()),
	updateChainTip:				app.locals.sql.prepare(filesystem.readFileSync('sql/query_update_chain_tip.sql', 'utf8').trim()),
};

// Enable support for cryptographic functions.
const crypto = require('crypto');

// Define protocol constants.
app.locals.protocol =
{
	blockModifier: 563620,
	nameRegexp: /[a-zA-Z0-9_]{1,99}/,
	hashRegexp: /[0-9]{1,10}/,
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
	},
	calculateAccountIdentity: function(blockhash, transactionhash)
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
		let emoji_codepoint = app.locals.protocol.emojiCodepoints[emoji_index];
		
		// Return the final account identity.
		return { collisionHash: account_hash_step5, accountEmoji: emoji_codepoint };
	},
}

// Configure the express application?
app.use(express.json());

// Ask express to parse proxy headers.
app.enable('trust proxy')

// Configure express to prettify json.
app.set('json spaces', 2);

// Create routes from separate files.
app.use('/newblock', require('./routes/parser.js'));
app.use('/status', require('./routes/status.js'));
app.use('/lookup', require('./routes/lookup.js'));
app.use('/account', require('./routes/metadata.js'));
//app.use('/register', require('./routes/register.js'));
//app.use('/statistics', require('./routes/statistics.js'));

// Parse blocks once on startup.
//parseBlock(null, null);

// Listen to incoming connections on port X.
app.listen(app.locals.config.server.port);
