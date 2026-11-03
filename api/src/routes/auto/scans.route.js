import { Router } from 'express'
import {
  checkScanInput,
  createScan,
  getAllScans,
  getScanById,
  getQuarantine
} from '../../services/scan.service.js'

const router = Router()

router.post('/api/scans', (req, res) => {
  const error = checkScanInput(req.body)

  if (error) {
    return res.status(error.code).json({
      error: true,
      message: error.message
    })
  }

  let ownerId = 'demo-user'

  if (req.user) {
    ownerId = req.user.id
  }

  const scan = createScan(ownerId, req.body)

  res.status(201).json({
    scan
  })
})

router.get('/api/scans', (req, res) => {
  res.status(200).json({
    scans: getAllScans()
  })
})

router.get('/api/scans/:id', (req, res) => {
  const scan = getScanById(Number(req.params.id))

  if (!scan) {
    return res.status(404).json({
      error: true,
      message: 'Scan not found'
    })
  }

  res.status(200).json({
    scan
  })
})

router.get('/api/quarantine', (req, res) => {
  res.status(200).json({
    files: getQuarantine()
  })
})

export default router
