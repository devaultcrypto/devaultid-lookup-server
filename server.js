// Include support for express applications.
const express = require('express');

// Create an instance of an express application.
const app = express();

// Configure the express application?
// app.use(express.json());

// Create routes from separate files.
app.use('/lookup', require('./routes/lookup.js'));
app.use('/register', require('./routes/register.js'));
app.use('/statistics', require('./routes/statistics.js'));

// Listen to incoming connections on port X.
app.listen(3000);
