---
name: backend-lib-drive
description: S3-compatible file storage via FlyDrive — upload, download, signed URLs.
---

# Backend Lib: Drive (S3-Compatible Storage)

Reference: [FlyDrive docs](https://flydrive.dev/docs/introduction)

## Where things live

- **Setup**: `server/lib/drive/index.ts` — `setupDrive()` registers the services on a `DriveManager`
- **Use**: `server/utils/drive.ts` → `useDrive()` (lazy, cached)

## Rules

- **Always call `.use()` to get a disk** — `useDrive()` returns the manager, not the disk. Different from every other `useXXX()` in this project.
- **Private buckets** — never expose them publicly. Generate signed URLs with explicit `expiresIn` for client access.
- **No `process.env` access from inside `setupDrive()` or services** — credentials and endpoints come through runtime config.

## Getting a disk

```typescript
const disk = useDrive().use()              // → default service
await disk.put('path/to/file.txt', buffer)
const signedUrl = await disk.getSignedUrl('path/to/file.txt', { expiresIn: 3600 })

// Use a non-default service explicitly
const local = useDrive().use('fs')
```

The manager pattern lets you target a different service per call without re-instantiating clients.

## Typical flow with uploaded files (example)

When pairing with the file-upload handler (`z.file()` body schemas), the service receives a `File` and writes it to the disk:

```typescript
const disk = useDrive().use()
const ext = file.type.split('/')[1]
const key = `projects/${crypto.randomUUID()}.${ext}`
const buffer = Buffer.from(await file.arrayBuffer())
await disk.put(key, buffer, { contentType: file.type })
```

`Buffer.from(await file.arrayBuffer())` is a cheap view, not a copy — safe to pass straight to `disk.put()`.

## Signed URLs (example)

```typescript
const url = await disk.getSignedUrl(key, { expiresIn: 3600 })
```
