/**
 * SCRUM-12 - Upload files (FR-STO-01)
 *   POST /api/files  -> upload 1 to 10 files (field name: "files", max 32 MB each)
 *   GET  /api/files  -> list my files
 */
import { Router } from 'express'
import multer from 'multer'
import { saveFile, listFiles, MAX_FILE_SIZE, MAX_FILES } from '../../services/file.service.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES }
})

/**
 * TEMPORARY: login (axis 1) does not exist yet, so every file belongs
 * to "demo-user". When login is ready, req.user.id will be used instead.
 */
export function getOwnerId (req) {
  return req.user?.id ?? 'demo-user'
}

const router = Router()

router.post('/api/files', (req, res, next) => {
  upload.array('files', MAX_FILES)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: true, message: 'File too large (max 32 MB)' })
      }
      return res.status(400).json({ error: true, message: err.message })
    }
    if (err) return next(err)

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: true, message: 'No file provided' })
    }

    try {
      const ownerId = getOwnerId(req)
      const saved = []
      for (const file of req.files) {
        saved.push(await saveFile(ownerId, file))
      }
      res.status(201).json({ files: saved })
    } catch (e) {
      next(e)
    }
  })
})

router.get('/api/files', async (req, res, next) => {
  try {
    const files = await listFiles(getOwnerId(req))
    res.status(200).json({ files })
  } catch (e) {
    next(e)
  }
})

export default router
