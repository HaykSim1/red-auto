import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { ApiException } from '../common/exceptions/api.exception';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UserRole } from '../database/enums';
import { PresignDto, UploadPurpose } from './dto/presign.dto';
import { createS3Client } from './s3-client';

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
    const client = createS3Client(this.config);

    if (!bucket || !client) {
      throw new ApiException(
        'uploads_unconfigured',
        'Object storage is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const ext = this.guessExt(dto.content_type);
    let prefix: string;
    if (dto.purpose === UploadPurpose.HOME_BANNER) {
      if (user.role !== UserRole.ADMIN) {
        throw new ApiException(
          'forbidden',
          'Admin only.',
          HttpStatus.FORBIDDEN,
        );
      }
      prefix = 'home_banners';
    } else if (dto.purpose === UploadPurpose.REQUEST_PHOTO) {
      prefix = `requests/${user.sub}`;
    } else if (dto.purpose === UploadPurpose.SHOP_LOGO) {
      prefix = `seller_shop_logos/${user.sub}`;
    } else if (dto.purpose === UploadPurpose.INVENTORY_PHOTO) {
      prefix = `inventory/${user.sub}`;
    } else {
      prefix = `offers/${user.sub}`;
    }
    const key = `${prefix}/${randomUUID()}${ext}`;

    // Omit ContentLength from the signature: browsers control Content-Length for fetch();
    // a signed length often causes S3 403 (SignatureDoesNotMatch / policy mismatch).
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: dto.content_type,
    });

    const url = await getSignedUrl(client, cmd, { expiresIn: 900 });

    return {
      url,
      method: 'PUT' as const,
      headers: {
        'Content-Type': dto.content_type,
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
