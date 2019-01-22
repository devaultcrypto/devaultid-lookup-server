module.exports = 
{
	//
	server:
	{
		// Which port the server should listen for requests on.
		port: 3001,

		// Where to store the servers database file(s).
		database: './database.db',

		// What data should be cached by the server.
		// 1: Minimal (Lookup transaction data and inclusion proofs on-demand)
		// 2: Default (Store transaction data and inclusion proofs in database)
		storage: 2,
	},

	// Location and credentials to connect to a fullnode RPC.
	node:
	{
		// The address where we can reach a Bitcoin RPC service.
		address: '127.0.0.1',

		// The port on which the Bitcoin RPC service listens to.
		port: '8332',

		// The username and password for the Bitcoin RPC service.
		user: '',
		pass: ''
	},
}
