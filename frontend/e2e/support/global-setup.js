import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ADMIN, bcrypt, db, disconnect, E2E_MONGO_URI } from './backend.js'

// Starts every run from empty collections and an empty upload folder, with one Admin account.
// Admin accounts are created by setup only; public registration cannot create them (SRS 2.3).
export default async function globalSetup() {
  if (!/_e2e$/.test(new URL(E2E_MONGO_URI).pathname)) {
    throw new Error(`Refusing to reset ${E2E_MONGO_URI}: the end-to-end database name must end in _e2e`)
  }
  const database = await db()
  // Playwright starts the API before this runs, and the API has already built its indexes (unique email,
  // material text search), so empty the collections instead of dropping the database.
  for (const collection of await database.collections()) await collection.deleteMany({})
  await database.collection('users').insertOne({
    name: ADMIN.name,
    email: ADMIN.email,
    passwordHash: await bcrypt.hash(ADMIN.password, 10),
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await disconnect()

  fs.rmSync(fileURLToPath(new URL('../../test-results/e2e-uploads', import.meta.url)), { recursive: true, force: true })
}
