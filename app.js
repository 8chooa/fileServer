const express = require('express');

const app = express();

const uploadRouter = require('./controllers/uploads');

app.use('/uploads', uploadRouter);

module.exports = app;
