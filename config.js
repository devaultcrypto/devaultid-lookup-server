module.exports = 
{
	// Operational mode, determines what data to store and process.
	mode: 'minimal',

	// Location and credentials to connect to a fullnode RPC.
	node:
	{
		address: '127.0.0.1',
		port: '8332',
		user: '',
		pass: ''
	},

	// Location where we will store the database.
	storage:
	{
		filename: './database.db'
	}
}
