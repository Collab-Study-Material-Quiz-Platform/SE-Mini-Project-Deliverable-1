const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const materialRoutes = require('./routes/materials');
const questionRoutes = require('./routes/questions');
const protectedFeatureRoutes = require('./routes/protectedFeatures');
const { rejectUnsafeInput } = require('./middleware/inputValidation');

const app = express();
app.use(cors());
app.use(express.json());
app.use(rejectUnsafeInput);

app.get('/', (req, res) => res.json({ message: 'Study Platform API running' }));
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api', protectedFeatureRoutes);
app.use('/', healthRoutes);

module.exports = app;
