require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { signToken } = require('../../utils/authToken');

const canUseDatabase = Boolean(process.env.MONGO_URI);
let userCounter = 0;

// Connects to MongoDB and starts the API on a random port. Returns the base URL and a stop function.
async function startTestServer(models = []) {
  const app = require('../../app');
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(models.map(model => model.init()));
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async stop() {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    },
  };
}

// Creates a user with the given role and returns it together with a valid bearer token.
async function createUserWithToken(role) {
  userCounter += 1;
  const user = await User.create({
    name: `Test ${role}`,
    email: `csq-${role}-${process.pid}-${Date.now()}-${userCounter}@example.test`,
    passwordHash: await bcrypt.hash('ExamplePassword1!', 10),
    role,
  });
  const token = signToken({ sub: user._id.toString(), role: user.role });
  return { user, token, headers: { Authorization: `Bearer ${token}` } };
}

module.exports = { canUseDatabase, startTestServer, createUserWithToken };
