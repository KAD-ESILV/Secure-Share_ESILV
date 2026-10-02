/**
 * GET /version → { version: "<package.json version>" }
 * Reads version from package.json to keep it source-of-truth.
 */
import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

router.get('/version', (_req, res) => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8')
  )
  res.status(200).json({ version: pkg.version })
})

export default router
