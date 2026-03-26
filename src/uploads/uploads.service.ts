import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { ApiException } from '../common/exceptions/api.exception';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { PresignDto, UploadPurpose } from './dto/presign.dto';

const MAX_BYTES = 15 * 1024 * 1024;

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  async presign(user: JwtUserPayload, dto: PresignDto) {
    if (dto.size > MAX_BYTES) {
      throw new ApiException(
        'bad_request',
        'File too large.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const bucket = this.config.get<string>('S3_BUCKET');
    const accessKey = this.config.get<string>('S3_ACCESS_KEY');
    const secretKey = this.config.get<string>('S3_SECRET_KEY');
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const endpoint = this.config.get<string>('S3_ENDPOINT');

    if (!bucket || !accessKey || !secretKey) {
      throw new ApiException(
        'uploads_unconfigured',
        'Object storage is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const ext = this.guessExt(dto.content_type);
    let prefix: string;
    if (dto.purpose === UploadPurpose.REQUEST_PHOTO) {
      prefix = `requests/${user.sub}`;
    } else if (dto.purpose === UploadPurpose.SHOP_LOGO) {
      prefix = `seller_shop_logos/${user.sub}`;
    } else {
      prefix = `offers/${user.sub}`;
    }
    const key = `${prefix}/${randomUUID()}${ext}`;

    const client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: dto.content_type,
      ContentLength: dto.size,
    });

    const url = await getSignedUrl(client, cmd, { expiresIn: 900 });

    return {
      url,
      method: 'PUT' as const,
      headers: {
        'Content-Type': dto.content_type,
        'Content-Length': String(dto.size),
      },
      storage_key: key,
      expires_in: 900,
    };
  }

  private guessExt(contentType: string): string {
    const m = contentType.split(';')[0]?.trim().toLowerCase();
    if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
    if (m === 'image/png') return '.png';
    if (m === 'image/webp') return '.webp';
    return '';
  }
}
