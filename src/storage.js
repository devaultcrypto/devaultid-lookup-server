// ???
module.exports = function(app)
{
	//
	app.locals.debug.struct('Initializing storage module.');

	// Enable support for sqlite databases.
	const Database = require('better-sqlite3');

	// Enable support for filesystem operations.
	const Filesystem = require('fs');

	// Open the database in read-write mode.
	app.locals.sql = new Database(app.locals.config.server.database, { memory: false, readonly: false });

	//
	app.locals.debug.silent('Created database connection.');

	// Configure database behaviour.
	{
		// Enable support for foreign keys.
		app.locals.sql.pragma('foreign_keys = ON');

		// Use up to 128mb memory as cache.
		// NOTE: this parameter is measured in pages, not bytes.
		//app.locals.sql.pragma('cache_size = 32768');

		// At the risk of database corruption, don't wait for filesystem.
		app.locals.sql.pragma('synchronous = OFF');

		// Allow the database to lock the database file on the operating system level.
		app.locals.sql.pragma('locking_mode = EXCLUSIVE');

		// Allow the database to keep the journal file when not in use, to prevent re-creating it repeatadly.
		app.locals.sql.pragma('journal_mode = TRUNCATE');
	}

	//
	app.locals.debug.silent('Configured database connection.');

	// Initialize the database
	{
		// Load the database schema.
		const databaseSchema = Filesystem.readFileSync('sql/database_schema.sql', 'utf8').trim();

		// Create the database schema.
		app.locals.sql.exec(databaseSchema);
	}

	//
	app.locals.debug.silent('Applied database table schema.');

	// Load the database queries.
	app.locals.queries = 
	{
		// 
		getStatus:					app.locals.sql.prepare(Filesystem.readFileSync('sql/query_get_status.sql', 'utf8').trim()),

		// Registration transaction lookup queries.
		lookupByIdentifier:			app.locals.sql.prepare(Filesystem.readFileSync('sql/query_lookup_by_identifier.sql', 'utf8').trim()),
		lookupByName:				app.locals.sql.prepare(Filesystem.readFileSync('sql/query_lookup_by_name.sql', 'utf8').trim()),
		lookupByBlock:				app.locals.sql.prepare(Filesystem.readFileSync('sql/query_lookup_by_block.sql', 'utf8').trim()),

		// Account metadata lookup queries.
		metadataByBlock:			app.locals.sql.prepare(Filesystem.readFileSync('sql/query_metadata_by_block.sql', 'utf8').trim()),
		metadataByName:				app.locals.sql.prepare(Filesystem.readFileSync('sql/query_metadata_by_name.sql', 'utf8').trim()),
		metadataByIdentifier:		app.locals.sql.prepare(Filesystem.readFileSync('sql/query_metadata_by_identifier.sql', 'utf8').trim()),

		// Block related queries.
		getBlockByHash:				app.locals.sql.prepare(Filesystem.readFileSync('sql/query_get_block_by_hash.sql', 'utf8').trim()),
		storeBlock:					app.locals.sql.prepare(Filesystem.readFileSync('sql/query_store_block.sql', 'utf8').trim()),
		linkBlock:					app.locals.sql.prepare(Filesystem.readFileSync('sql/query_link_block.sql', 'utf8').trim()),

		// Transaction related queries.
		storeTransaction:			app.locals.sql.prepare(Filesystem.readFileSync('sql/query_store_transaction.sql', 'utf8').trim()),
		getTransactionByHash:		app.locals.sql.prepare(Filesystem.readFileSync('sql/query_get_transaction_by_hash.sql', 'utf8').trim()),
		linkBlockTransaction:		app.locals.sql.prepare(Filesystem.readFileSync('sql/query_link_block_transaction.sql', 'utf8').trim()),

		// Payload related queries.
		getPayload:					app.locals.sql.prepare(Filesystem.readFileSync('sql/query_get_payload.sql', 'utf8').trim()),
		storePayload:				app.locals.sql.prepare(Filesystem.readFileSync('sql/query_store_payload.sql', 'utf8').trim()),
		linkAccountPayload:			app.locals.sql.prepare(Filesystem.readFileSync('sql/query_link_account_payload.sql', 'utf8').trim()),

		// Account related queries.
		storeAccount:				app.locals.sql.prepare(Filesystem.readFileSync('sql/query_store_account.sql', 'utf8').trim()),
		getAccountByTransactionId:	app.locals.sql.prepare(Filesystem.readFileSync('sql/query_get_account_by_transaction_id.sql', 'utf8').trim()),

		//
		storeName:					app.locals.sql.prepare(Filesystem.readFileSync('sql/query_store_name.sql', 'utf8').trim()),
		getName:					app.locals.sql.prepare(Filesystem.readFileSync('sql/query_get_name.sql', 'utf8').trim()),

		// Other queries.
		invalidateRegistration:		app.locals.sql.prepare(Filesystem.readFileSync('sql/query_invalidate_registration.sql', 'utf8').trim()),
		getServiceStatus:			app.locals.sql.prepare(Filesystem.readFileSync('sql/query_get_service_status.sql', 'utf8').trim()),
		updateServiceStatus:		app.locals.sql.prepare(Filesystem.readFileSync('sql/query_update_service_status.sql', 'utf8').trim()),
		updateChainTip:				app.locals.sql.prepare(Filesystem.readFileSync('sql/query_update_chain_tip.sql', 'utf8').trim()),
	};

	//
	app.locals.debug.silent('Prepared database queries from disk.');

	// Close the database on application exit.
	process.on
	(
		'beforeExit', 
		function(code)
		{
			app.locals.debug.struct('Closing the database.');

			// Close the database.
			app.locals.sql.close();
		}
	);

	//
	app.locals.debug.struct('Completed storage module initialization.');
}
