// Read the configuration file.
const config = require("./config.js");

// Enable support for filesystem operations.
const filesystem = require('fs');

// Enable RPC connections.
const rpc = require('node-bitcoin-rpc');

// Enable support for sqlite databases.
const Database = require('better-sqlite3');

// Open the database in read-write mode.
const sql = new Database(config.storage.filename, { readonly: false });

// Enable support for foreign keys.
sql.pragma('foreign_keys = ON');

// Load the available database queries.
//const queryName = filesystem.readFileSync('sql/query_name.sql', 'utf8');

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
let block_chain = sql.prepare('SELECT block_height FROM service_status LEFT JOIN blocks ON (chain_tip = block_hash)').get();

console.log(block_chain.block_height);	

// 
rpc.setTimeout(2500);

//
rpc.init(config.node.address, config.node.port, config.node.user, config.node.pass);

rpc.call('getblockhash', [block_chain.block_height + 1], (error, result) => 
{
	if(error)
	{
		console.log("getblockhash", error);
		//return res.status(500).json({ err: err });
	}

	console.log(result);
});

// Close the database.
sql.close();
