// ???
module.exports = function(app)
{
	//
	app.locals.debug.struct('Initializing network module.');

	//
	const axios = require('axios');

	//
	app.locals.rpc = async function(method, ...params)
	{
		app.locals.debug.silent('Preparing to call ' + method + " with " + params.length + " parameters.");

		// Initialize a request body.
		let body = 
		{
			jsonrpc: '1.0',
			id: Date.now(),
			method: method.toLowerCase()
		};

		// If parameters was supplied..
		if(params.length)
		{
			// Add them to the request body.
			body.params = params;
		}

		// Construct the request object.
		let req =
		{
			method: 'POST',
			headers:
			{
				'Content-Type': 'text/plain'
			},
			url: 'http://' + app.locals.config.node.address + ':' + app.locals.config.node.port + '/',
			auth:
			{
				username: app.locals.config.node.user,
				password: app.locals.config.node.pass
			},
			timeout: 5000,
			data: JSON.stringify(body)
		};

		app.locals.debug.silent('Calling ' + method + " with " + params.length + " parameters.");
		app.locals.debug.object(req);

		// Send the call and return the data from the results.
		return axios(req).then
		(
			response => 
			{
				return response.data.result;
			}
		);
	};

	//
	app.locals.debug.silent('Prepared connection to Bitcoin RPC node.');

	//
	app.locals.debug.struct('Completed network module initialization.');
}
