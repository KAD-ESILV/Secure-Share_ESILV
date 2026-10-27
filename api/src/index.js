/**
 * App entrypoint.
 * We keep the HTTP listener separate from the Express app instance so
 * tests can import `app` without opening a real port.
 */
import app from './app.js'

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
})
