import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3, bucket } from '../config/storage.js'

export async function readStoredFile (storageKey) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey
  })

  const response = await s3.send(command)
  const bytes = await response.Body.transformToByteArray()

  return Buffer.from(bytes)
}
