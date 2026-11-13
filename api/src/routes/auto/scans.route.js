import { Router } from 'express'
import { listScans, listQuarantine, getFileForScan } from '../../services/scan.repository.js'
import { enqueueScan, getQueueSize } from '../../services/scan.queue.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const router = Router()

function requireAdmin (req, res, next) {
  if (req.user && req.user.role !== 'admin') {
    return res.status(403).json({
      error: true,
      message: 'Admin only'
    })
  }

  next()
}

router.get('/api/scans', requireAdmin, async (req, res, next) => {
  try {
    const scans = await listScans()

    res.status(200).json({
      scans,
      waiting: getQueueSize()
    })
  } catch (err) {
    next(err)
  }
})

router.get('/api/quarantine', requireAdmin, async (req, res, next) => {
  try {
    const files = await listQuarantine()

    res.status(200).json({
      files
    })
  } catch (err) {
    next(err)
  }
})

router.post('/api/scans/:fileId', requireAdmin, async (req, res, next) => {
  const fileId = req.params.fileId

  if (!UUID.test(fileId)) {
    return res.status(400).json({
      error: true,
      message: 'Invalid file id'
    })
  }

  try {
    const file = await getFileForScan(fileId)

    if (!file) {
      return res.status(404).json({
        error: true,
        message: 'File not found'
      })
    }

    enqueueScan(fileId)

    res.status(202).json({
      message: 'Scan queued',
      fileId
    })
  } catch (err) {
    next(err)
  }
})

export default router
