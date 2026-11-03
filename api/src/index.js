/**
 * App entrypoint.
 * We keep the HTTP listener separate from the Express app instance so
 * tests can import `app` without opening a real port.
 * On start, it creates the database tables and the storage bucket.
 */
import app from './app.js'
import { initDb } from './db/init.js'
import { ensureBucket } from './config/storage.js'

const PORT = process.env.PORT || 3000

async function initWithRetry (retries = 15) {
  for (let i = 1; i <= retries; i++) {
    try {
      await initDb()
      await ensureBucket()
      console.log('[init] database and storage ready')
      return
    } catch (err) {
      console.log(`[init] attempt ${i}/${retries} failed: ${err.message}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  console.error('[init] could not reach the database or the storage')
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  initWithRetry()
})
