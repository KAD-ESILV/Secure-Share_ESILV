const API_URL = 'https://www.virustotal.com/api/v3'

let lastCall = 0

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getApiKey () {
  const key = process.env.VIRUSTOTAL_API_KEY

  if (!key || key === 'change-me') {
    throw new Error('VIRUSTOTAL_API_KEY is missing in .env')
  }

  return key
}

async function waitForSlot () {
  const delay = Number(process.env.VIRUSTOTAL_DELAY_MS || 15000)
  const wait = lastCall + delay - Date.now()

  if (wait > 0) {
    await sleep(wait)
  }

  lastCall = Date.now()
}

async function callApi (path, options) {
  const key = getApiKey()

  await waitForSlot()

  return fetch(API_URL + path, {
    ...options,
    headers: {
      'x-apikey': key
    }
  })
}

export async function lookupHash (sha256) {
  const response = await callApi('/files/' + sha256)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('VirusTotal lookup failed: ' + response.status)
  }

  const body = await response.json()

  return body.data.attributes.last_analysis_stats
}

export async function uploadFile (buffer, fileName) {
  const form = new FormData()
  form.append('file', new Blob([buffer]), fileName)

  const response = await callApi('/files', {
    method: 'POST',
    body: form
  })

  if (!response.ok) {
    throw new Error('VirusTotal upload failed: ' + response.status)
  }

  const body = await response.json()

  return body.data.id
}

export async function getAnalysis (analysisId) {
  const response = await callApi('/analyses/' + analysisId)

  if (!response.ok) {
    throw new Error('VirusTotal analysis failed: ' + response.status)
  }

  const body = await response.json()

  return {
    done: body.data.attributes.status === 'completed',
    stats: body.data.attributes.stats
  }
}

export function getVerdict (stats) {
  if (stats.malicious > 0) {
    return 'malicious'
  }

  if (stats.suspicious > 0) {
    return 'suspicious'
  }

  return 'clean'
}
