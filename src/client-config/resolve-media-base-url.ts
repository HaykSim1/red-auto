import type { ConfigService } from '@nestjs/config';

/**
 * Public base URL for concatenating with object `storage_key` (path-style:
 * `${base}/${key}`). Prefer explicit S3_PUBLIC_URL; otherwise derive MinIO-style
 * `${S3_ENDPOINT}/${S3_BUCKET}` when both are set.
 */
export function resolveMediaBaseUrl(config: ConfigService): string | null {
  const explicit = config.get<string>('S3_PUBLIC_URL')?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const endpoint = config.get<string>('S3_ENDPOINT')?.trim();
  const bucket = config.get<string>('S3_BUCKET')?.trim();
  if (!endpoint || !bucket) return null;

  return `${endpoint.replace(/\/$/, '')}/${bucket}`;
}
