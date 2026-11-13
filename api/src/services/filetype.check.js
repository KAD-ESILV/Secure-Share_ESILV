import { fileTypeFromBuffer } from 'file-type'

const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'dll', 'vbs', 'js', 'jar', 'ps1', 'sh']

const EXECUTABLE_TYPES = ['exe', 'elf', 'macho', 'class']

const SAME_TYPE = {
  jpeg: 'jpg',
  tiff: 'tif'
}

const ZIP_BASED = ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub']

export function getExtension (fileName) {
  const dot = fileName.lastIndexOf('.')

  if (dot <= 0) {
    return ''
  }

  const extension = fileName.slice(dot + 1).toLowerCase()

  if (SAME_TYPE[extension]) {
    return SAME_TYPE[extension]
  }

  return extension
}

function matches (extension, detected) {
  if (extension === detected) {
    return true
  }

  return detected === 'zip' && ZIP_BASED.includes(extension)
}

export async function checkRealType (buffer, fileName) {
  const extension = getExtension(fileName)
  const detected = await fileTypeFromBuffer(buffer)

  if (detected && EXECUTABLE_TYPES.includes(detected.ext)) {
    return {
      status: 'malicious',
      reason: 'The file is really a program (' + detected.ext + ')'
    }
  }

  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    return {
      status: 'malicious',
      reason: 'Dangerous extension: .' + extension
    }
  }

  if (detected && !matches(extension, detected.ext)) {
    return {
      status: 'suspicious',
      reason: 'The file is really a .' + detected.ext + ' but is named .' + extension
    }
  }

  return {
    status: 'clean',
    reason: null
  }
}
