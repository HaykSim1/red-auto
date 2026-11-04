import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

/** S3 client from env, or null when the bucket or credentials are missing. */
export function createS3Client(config: ConfigService): S3Client | null {
  const bucket = config.get<string>('S3_BUCKET');
  const accessKey = config.get<string>('S3_ACCESS_KEY');
  const secretKey = config.get<string>('S3_SECRET_KEY');
  const region = config.get<string>('S3_REGION') ?? 'us-east-1';
  const endpoint = config.get<string>('S3_ENDPOINT');

  if (!bucket || !accessKey || !secretKey) return null;

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    // Default WHEN_SUPPORTED adds x-amz-checksum-* to presigned URLs; browsers cannot satisfy that
    // reliably for direct PUT. WHEN_REQUIRED matches PutObject and keeps URLs simpler for admin web.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
}
