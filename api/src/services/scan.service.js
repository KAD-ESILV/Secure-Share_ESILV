const MAX_SIZE = 32 * 1024 * 1024

const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'dll', 'vbs', 'js', 'jar', 'ps1', 'sh']

const EXPECTED_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip'
}

const scans = []
let nextId = 1

export function getExtension (fileName) {
  const dot = fileName.lastIndexOf('.')

  if (dot <= 0) {
    return ''
  }

  return fileName.slice(dot + 1).toLowerCase()
}

export function analyzeFile (fileName, mimeType) {
  const extension = getExtension(fileName)

  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    return {
      status: 'malicious',
      reason: 'Dangerous extension: .' + extension
    }
  }

  const expectedType = EXPECTED_TYPES[extension]

  if (expectedType && expectedType !== mimeType) {
    return {
      status: 'suspicious',
      reason: 'File type does not match extension .' + extension
    }
  }

  return {
    status: 'clean',
    reason: null
  }
}

export function checkScanInput (body) {
  if (!body || !body.fileName || !body.mimeType || body.size === undefined) {
    return {
      code: 400,
      message: 'Missing required fields: fileName, mimeType, size'
    }
  }

  if (typeof body.fileName !== 'string' || typeof body.mimeType !== 'string') {
    return {
      code: 400,
      message: 'fileName and mimeType must be text'
    }
  }

  if (typeof body.size !== 'number' || body.size <= 0) {
    return {
      code: 400,
      message: 'size must be a positive number'
    }
  }

  if (body.size > MAX_SIZE) {
    return {
      code: 413,
      message: 'File too large (max 32 MB)'
    }
  }

  return null
}

export function createScan (ownerId, file) {
  const result = analyzeFile(file.fileName, file.mimeType)

  const scan = {
    id: nextId,
    ownerId,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    status: result.status,
    reason: result.reason,
    quarantined: result.status !== 'clean',
    scannedAt: new Date().toISOString()
  }

  nextId++
  scans.push(scan)

  return scan
}

export function getAllScans () {
  return scans
}

export function getScanById (id) {
  return scans.find((scan) => scan.id === id)
}

export function getQuarantine () {
  return scans.filter((scan) => scan.quarantined)
}
