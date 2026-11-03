/**
 * SeaweedFS client (S3 compatible API).
 * S3_ENDPOINT, S3_BUCKET and the keys come from docker-compose.yml / .env.
 */
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3'

export const bucket = process.env.S3_BUCKET || 'secureshare-files'

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:8333',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'dev',
    secretAccessKey: process.env.S3_SECRET_KEY || 'dev'
  }
})

/** Creates the bucket the first time the platform starts. */
export async function ensureBucket () {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  }
}

/** Stores one object (the file content) in SeaweedFS. */
export function putObject (key, body, contentType) {
  return s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  }))
}
