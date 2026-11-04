import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createS3Client } from '../../uploads/s3-client';

export type RecognitionImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export interface RecognitionImage {
  media_type: RecognitionImageMediaType;
  data: string;
}

export function mediaTypeForKey(key: string): RecognitionImageMediaType {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  throw new Error(`Unsupported photo type for key ${key}`);
}

/** Reads uploaded photos back from object storage as base64 for the model. */
@Injectable()
export class S3ObjectReader {
  private client: S3Client | null | undefined;

  constructor(private readonly config: ConfigService) {}

  async getImage(storageKey: string): Promise<RecognitionImage> {
    const bucket = this.config.get<string>('S3_BUCKET');
    if (this.client === undefined) this.client = createS3Client(this.config);
    if (!bucket || !this.client) {
      throw new Error('Object storage is not configured.');
    }
    const media_type = mediaTypeForKey(storageKey);
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    );
    if (!out.Body) throw new Error(`Empty object body for key ${storageKey}`);
    const bytes = await out.Body.transformToByteArray();
    return { media_type, data: Buffer.from(bytes).toString('base64') };
  }
}
