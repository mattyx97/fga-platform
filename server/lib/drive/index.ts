import { DriveManager } from 'flydrive'
import { FSDriver } from 'flydrive/drivers/fs'
import { S3Driver } from 'flydrive/drivers/s3'

export type IDrive = ReturnType<typeof setupDrive>
export function setupDrive(config: {
  s3: {
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    region: string
    endpoint?: string
    cdnUrl?: string
  }
}) {
  return new DriveManager({
    default: 's3',
    services: {
      fs: () =>
        new FSDriver({
          location: new URL('./uploads', import.meta.url),
          visibility: 'public',
        }),
      s3: () => {
        return new S3Driver({
          credentials: {
            accessKeyId: config.s3.accessKeyId,
            secretAccessKey: config.s3.secretAccessKey,
          },
          endpoint: config.s3.endpoint,
          forcePathStyle: !!config.s3.endpoint,
          cdnUrl: config.s3.cdnUrl,
          region: config.s3.region,
          bucket: config.s3.bucket,
          visibility: 'private',
        })
      },
    },
  })
}
