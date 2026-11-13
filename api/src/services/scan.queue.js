import { scanFile } from './scanner.js'
import { getPendingFileIds } from './scan.repository.js'

const waiting = []
let running = false
let idle = Promise.resolve()

async function processQueue () {
  running = true

  while (waiting.length > 0) {
    const fileId = waiting.shift()

    try {
      await scanFile(fileId)
    } catch (err) {
      console.error('[scan] ' + fileId + ' failed: ' + err.message)
    }
  }

  running = false
}

export function enqueueScan (fileId) {
  if (!waiting.includes(fileId)) {
    waiting.push(fileId)
  }

  if (!running) {
    idle = processQueue()
  }

  return idle
}

export async function resumePendingScans () {
  const fileIds = await getPendingFileIds()

  for (const fileId of fileIds) {
    enqueueScan(fileId)
  }

  return fileIds.length
}

export function getQueueSize () {
  return waiting.length
}

export function whenIdle () {
  return idle
}
