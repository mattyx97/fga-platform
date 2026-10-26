import type { IDrive } from '#server/lib/drive'
import { setupDrive } from '#server/lib/drive'

let _cache: IDrive
export function useDrive() {
  return _cache ??= setupDrive({
    s3: {
      bucket: useRuntimeConfig().DRIVE_S3_BUCKET,
      accessKeyId: useRuntimeConfig().DRIVE_S3_ACCESS_KEY_ID,
      secretAccessKey: useRuntimeConfig().DRIVE_S3_SECRET_ACCESS_KEY,
      region: useRuntimeConfig().DRIVE_S3_REGION,
      endpoint: useRuntimeConfig().DRIVE_S3_ENDPOINT,
      cdnUrl: useRuntimeConfig().DRIVE_S3_CDN_URL,
    },
  })
}
