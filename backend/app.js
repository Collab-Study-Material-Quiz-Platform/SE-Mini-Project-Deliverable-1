const express = require('express');
const cors = require('cors');
const healthRoute = require('./routes/health');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Collaborative Study Platform API' }));
app.use('/', healthRoute);

module.exports = app;
