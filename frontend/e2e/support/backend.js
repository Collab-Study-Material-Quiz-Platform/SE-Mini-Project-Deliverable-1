// Direct access to the backend's database and token code, for test setup and for checks the UI cannot show
// (stored password hashes, audit entries, expired tokens).
import { createRequire } from 'node:module'

const backendRequire = createRequire(new URL('../../../backend/package.json', import.meta.url))
export const mongoose = backendRequire('mongoose')
export const bcrypt = backendRequire('bcryptjs')

export const E2E_MONGO_URI = process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017/studyplatform_e2e'

export async function db() {
  if (mongoose.connection.readyState !== 1) await mongoose.connect(E2E_MONGO_URI)
  return mongoose.connection.db
}

export async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}

// The backend runs with NODE_ENV=development in these tests, so it signs tokens with the development secret.
export function signToken(payload, issuedAt) {
  process.env.NODE_ENV = process.env.NODE_ENV || 'development'
  return backendRequire('./utils/authToken').signToken(payload, issuedAt)
}

export const ADMIN = { name: 'E2E Admin', email: 'admin@e2e.test', password: 'AdminPass123', role: 'admin' }
