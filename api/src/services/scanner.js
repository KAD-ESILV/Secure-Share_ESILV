import { decryptFile, getMasterKey } from '../utils/crypto.js'
import { checkRealType } from './filetype.check.js'
import { lookupHash, uploadFile, getAnalysis, getVerdict } from './virustotal.js'
import { getFileForScan, saveScanResult } from './scan.repository.js'
import { readStoredFile } from './scan.storage.js'

const MAX_POLLS = 8

function fromStats (stats, source) {
  const status = getVerdict(stats)
  let reason = null

  if (status !== 'clean') {
    reason = (stats.malicious + stats.suspicious) + ' antivirus engines flagged this file'
  }

  return {
    status,
    reason,
    source,
    malicious: stats.malicious,
    suspicious: stats.suspicious
  }
}

async function readAndDecrypt (file) {
  const body = await readStoredFile(file.storage_key)

  return decryptFile({
    body,
    iv: file.enc_iv,
    tag: file.enc_tag,
    wrappedKey: file.enc_key
  }, getMasterKey())
}

async function waitForAnalysis (analysisId) {
  for (let i = 0; i < MAX_POLLS; i++) {
    const analysis = await getAnalysis(analysisId)

    if (analysis.done) {
      return analysis.stats
    }
  }

  throw new Error('VirusTotal analysis took too long')
}

async function analyze (file) {
  const buffer = await readAndDecrypt(file)
  const local = await checkRealType(buffer, file.original_name)

  if (local.status !== 'clean') {
    return {
      status: local.status,
      reason: local.reason,
      source: 'file-type',
      malicious: 0,
      suspicious: 0
    }
  }

  const known = await lookupHash(file.content_sha256)

  if (known) {
    return fromStats(known, 'virustotal-hash')
  }

  if (process.env.VIRUSTOTAL_UPLOAD === 'false') {
    return {
      status: 'clean',
      reason: 'Unknown to VirusTotal, upload disabled',
      source: 'virustotal-hash',
      malicious: 0,
      suspicious: 0
    }
  }

  const analysisId = await uploadFile(buffer, file.original_name)
  const stats = await waitForAnalysis(analysisId)

  return fromStats(stats, 'virustotal-upload')
}

export async function scanFile (fileId) {
  const file = await getFileForScan(fileId)

  if (!file) {
    return null
  }

  let result

  try {
    result = await analyze(file)
  } catch (err) {
    result = {
      status: 'error',
      reason: err.message,
      source: 'scanner',
      malicious: 0,
      suspicious: 0
    }
  }

  await saveScanResult(fileId, result)

  return result
}
