module.exports = 
{
	//
	server:
	{
		// Which port the server should listen for requests on.
		port: 8585,

		// Where to store the servers database file(s).
		database: './database.db',

		// What data should be cached by the server.
		// 1: Minimal (Lookup transaction data and inclusion proofs on-demand)
		// 2: Default (Store transaction data and inclusion proofs in database)
		storage: 2,

		// Should we enable pre-parsed metadata requests?
		metadata: false,

		// Should we enable free registrations?
		register: false
	},

	// Location and credentials to connect to a fullnode RPC.
	node:
	{
		// The address where we can reach a DeVault RPC service.
		address: '127.0.0.1',

		// The port on which the DeVault RPC service listens to.
		port: '8332',

		// The username and password for the DeVault RPC service.
		user: '',
		pass: ''
	},
}
