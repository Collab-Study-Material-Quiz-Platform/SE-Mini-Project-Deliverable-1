const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Study Platform API running' }));
app.use('/api/auth', authRoutes);
app.use('/', healthRoutes);

module.exports = app;
