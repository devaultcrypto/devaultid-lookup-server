// Enable support for configurable debugging.
const debug =
{
	status: require('debug')('calus:status'),
	object: require('debug')('calus:object'),
	errors: require('debug')('calus:errors'),
}

// Enable lookup messages by default.
debug.status.enabled = true;
debug.errors.enabled = true;

// Read the configuration file.
const config = require("../config.js");

// Enable support for filesystem operations.
const filesystem = require('fs');

// Enable support for sqlite databases.
const Database = require('better-sqlite3');

// Open the database in read-write mode.
const sql = new Database(config.server.database, { memory: false, readonly: true });

// Load the database queries.
const queries = 
{
	getStatus: sql.prepare(filesystem.readFileSync('sql/query_get_status.sql', 'utf8').trim()),
};

// Enable support for Express apps.
const express = require('express');
const router = express.Router();

//
router.get('/', async function (req, res)
{
	//
	debug.status('Service status requested by ' + req.ip);

	try
	{
		// Query the database for the result.
		let result = queries.getStatus.get();

		// 
		debug.status('Service status delivered to ' + req.ip);
		debug.object(result);

		// Return a 200 OK with the lookup result.
		return res.status(200).json(result);
	}
	catch(error)
	{
		// Log an error for an administrator to investigate.
		debug.errors('Failed to lookup account:', error);

		// Return a 500 Internal Server Error.
		return res.status(500);
	}
});

module.exports = router;
