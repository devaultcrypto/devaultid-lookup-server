// Enable support for Express apps.
const express = require('express');
const router = express.Router();

//
router.get('/', async function (req, res)
{
	//
	req.app.locals.debug.status('Service status requested by ' + req.ip);

	try
	{
		// Query the database for the result.
		let result = req.app.locals.queries.getStatus.get();

		// Add capabilities
		result.features =
		{
			lookup: true,
			account: true,
			register: false
		}

		// Add software information.
		result.software =
		{
			program: req.app.locals.software.name,
			version: req.app.locals.software.version,
			website: req.app.locals.software.homepage
		}

		// 
		req.app.locals.debug.status('Service status delivered to ' + req.ip);
		req.app.locals.debug.object(result);

		// Return a 200 OK with the lookup result.
		return res.status(200).json(result);
	}
	catch(error)
	{
		// Log an error for an administrator to investigate.
		req.app.locals.debug.errors('Failed to lookup account:', error);

		// Return a 500 Internal Server Error.
		return res.status(500);
	}
});

module.exports = router;
