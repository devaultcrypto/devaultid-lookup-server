// Include support for express applications.
const express = require('express');

// Create an instance of an express application.
const app = express();

// Configure the express application?
app.use(express.json());

// Ask express to parse proxy headers.
app.enable('trust proxy')

// Configure express to prettify json.
app.set('json spaces', 2);

// Create routes from separate files.
app.use('/newblock', require('./routes/parser.js'));
app.use('/status', require('./routes/status.js'));
app.use('/lookup', require('./routes/lookup.js'));
app.use('/account', require('./routes/metadata.js'));
//app.use('/register', require('./routes/register.js'));
//app.use('/statistics', require('./routes/statistics.js'));

// Listen to incoming connections on port X.
app.listen(3001);
