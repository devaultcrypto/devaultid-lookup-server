// Include support for express applications.
const express = require('express');

// Create an instance of an express application.
const app = express();

// Add support for Cross-Origin settings.
const cors = require('cors');

// Add support for parsing POST bodies.
const bodyParser = require('body-parser');

// Enable parsing of both JSON and URL-encoded bodies.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Load the configuration file.
app.locals.config = require("./config.js");

// Read the package information file.
app.locals.software = require("./package.json");

// Load application modules.
require("./src/logging.js")(app);
require("./src/storage.js")(app);
require("./src/network.js")(app);
require("./src/protocol.js")(app);

//
app.locals.debug.struct('Starting service initialization.');

// Configure CORS an Express settings.
app.use(cors());
app.use(express.json());

// Ask express to parse proxy headers.
app.enable('trust proxy')

// Configure express to prettify json.
app.set('json spaces', 2);

// Create routes from separate files.
app.use('/status', require('./routes/status.js'));
app.use('/display', require('./routes/display.js'));
app.use('/lookup', require('./routes/lookup.js'));
app.use('/account', require('./routes/metadata.js'));
app.use('/register', require('./routes/register.js'));
//app.use('/statistics', require('./routes/statistics.js'));
app.use('/newblock', require('./routes/parser.js'));

// Listen to incoming connections on port X.
app.listen(app.locals.config.server.port);

// Notify user that the service is ready for incoming connections.
app.locals.debug.struct('Completed service initialization.');
app.locals.debug.status('Listening for incoming connections on port ' + app.locals.config.server.port);
