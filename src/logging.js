module.exports = function(app)
{
	// Enable support for configurable debugging.
	app.locals.debug =
	{
		// Action logs
		action: require('debug')('calus:action'),

		// Blocks log block detection and block handling.
		blocks: require('debug')('calus:blocks'),

		// Errors log problems that happen internally.
		errors: require('debug')('calus:errors'),

		// Object logs full data structures.
		object: require('debug')('calus:object'),

		// Parser logs block, transaction and registration progress.
		parser: require('debug')('calus:parser'),

		// Result logs block, transaction and registration results.
		result: require('debug')('calus:result'),

		// Server logs interactions with clients.
		server: require('debug')('calus:server'),

		// Silent logs everything that has no other category.
		silent: require('debug')('calus:silent'),

		// Status logs changes to the servers operational mode.
		status: require('debug')('calus:status'),

		// Struct logs the servers overall process structure.
		struct: require('debug')('calus:struct'),

		// Timers log performance metrics.
		timers: require('debug')('calus:timers'),
		timer1: require('debug')('calus:timer1'),
		timer2: require('debug')('calus:timer2'),
		timer3: require('debug')('calus:timer3'),
		timer4: require('debug')('calus:timer4'),
		timer5: require('debug')('calus:timer5'),
		timer6: require('debug')('calus:timer6'),
		timer7: require('debug')('calus:timer7'),
		timer8: require('debug')('calus:timer8'),
		timer9: require('debug')('calus:timer9'),
	}

	// Enable lookup messages by default.
	app.locals.debug.errors.enabled = true;
	app.locals.debug.status.enabled = true;
	app.locals.debug.blocks.enabled = true;
	//app.locals.debug.result.enabled = true;

	// Notify the user that logging has been initialized.
	app.locals.debug.struct('Completed logging initialization.');
}
