/**
 * Axis 2 - Files API (full CRUD, Labs 5 and 6)
 *   POST   /api/files               -> upload 1 to 10 files (field "files", max 32 MB each)   SCRUM-12
 *   GET    /api/files               -> list my files                                          SCRUM-12
 *   GET    /api/files/:id           -> information of one file
 *   GET    /api/files/:id/download  -> download the decrypted file                            FR-STO-09
 *   PUT    /api/files/:id           -> rename a file   body: { "name": "new-name.pdf" }
 *   DELETE /api/files/:id           -> delete a file                                          FR-STO-04
 */
import { Router } from 'express'
import multer from 'multer'
import {
  saveFile,
  listFiles,
  getFile,
  downloadFile,
  renameFile,
  deleteFile,
  validateFileName,
  MAX_FILE_SIZE,
  MAX_FILES
} from '../../services/file.service.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES }
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * TEMPORARY: login (axis 1) does not exist yet, so every file belongs
 * to "demo-user". When login is ready, req.user.id will be used instead.
 */
export function getOwnerId (req) {
  return req.user?.id ?? 'demo-user'
}

function notFound (res) {
  return res.status(404).json({ error: true, message: 'File not found' })
}

const router = Router()

// An id that is not a UUID can never exist: answer 404 without asking the database
router.param('id', (req, res, next, id) => {
  if (!UUID_REGEX.test(id)) return notFound(res)
  next()
})

// CREATE
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

// READ all
router.get('/api/files', async (req, res, next) => {
  try {
    const files = await listFiles(getOwnerId(req))
    res.status(200).json({ files })
  } catch (e) {
    next(e)
  }
})

// READ one
router.get('/api/files/:id', async (req, res, next) => {
  try {
    const file = await getFile(getOwnerId(req), req.params.id)
    if (!file) return notFound(res)
    res.status(200).json({ file })
  } catch (e) {
    next(e)
  }
})

// READ content (download)
router.get('/api/files/:id/download', async (req, res, next) => {
  try {
    const file = await downloadFile(getOwnerId(req), req.params.id)
    if (!file) return notFound(res)
    res.status(200)
    res.type(file.mimeType || 'application/octet-stream')
    res.attachment(file.name)
    res.send(file.content)
  } catch (e) {
    next(e)
  }
})

// UPDATE (rename)
router.put('/api/files/:id', async (req, res, next) => {
  const error = validateFileName(req.body?.name)
  if (error) return res.status(400).json({ error: true, message: error })

  try {
    const file = await renameFile(getOwnerId(req), req.params.id, req.body.name)
    if (!file) return notFound(res)
    res.status(200).json({ file })
  } catch (e) {
    next(e)
  }
})

// DELETE
router.delete('/api/files/:id', async (req, res, next) => {
  try {
    const deleted = await deleteFile(getOwnerId(req), req.params.id)
    if (!deleted) return notFound(res)
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

export default router
