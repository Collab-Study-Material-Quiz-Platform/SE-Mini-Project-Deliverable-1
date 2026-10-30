require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const RevokedToken = require('./models/RevokedToken');

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be configured before starting the API');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await RevokedToken.init();
  console.log('MongoDB connected');
  return app.listen(PORT, () => console.log('Server on port ' + PORT));
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
