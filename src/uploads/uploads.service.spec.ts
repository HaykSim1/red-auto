import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/exceptions/api.exception';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { UserRole } from '../database/enums';
import { UploadPurpose } from './dto/presign.dto';
import { UploadsService } from './uploads.service';

const ENV: Record<string, string> = {
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY: 'access',
  S3_SECRET_KEY: 'secret',
  S3_REGION: 'us-east-1',
};
const USER: JwtUserPayload = {
  sub: 'shop-1',
  role: UserRole.SELLER,
  phone_verified: true,
};

describe('UploadsService.presign', () => {
  const service = new UploadsService({
    get: (k: string) => ENV[k],
  } as unknown as ConfigService);

  it('rejects non-image content types for inventory photos', async () => {
    const err: unknown = await service
      .presign(USER, {
        purpose: UploadPurpose.INVENTORY_PHOTO,
        content_type: 'image/heic',
        size: 1000,
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiException);
    expect((err as ApiException).code).toBe('unsupported_media_type');
    expect((err as ApiException).getStatus()).toBe(400);
  });

  it('accepts JPEG, PNG and WebP inventory photos under the shop prefix', async () => {
    for (const [type, ext] of [
      ['image/jpeg', '.jpg'],
      ['image/jpg', '.jpg'],
      ['image/png', '.png'],
      ['image/webp; charset=binary', '.webp'],
    ]) {
      const res = await service.presign(USER, {
        purpose: UploadPurpose.INVENTORY_PHOTO,
        content_type: type,
        size: 1000,
      });
      expect(res.storage_key).toMatch(
        new RegExp(`^inventory/shop-1/[0-9a-f-]+\\${ext}$`),
      );
    }
  });

  it('does not restrict other purposes', async () => {
    const res = await service.presign(USER, {
      purpose: UploadPurpose.REQUEST_PHOTO,
      content_type: 'image/heic',
      size: 1000,
    });
    expect(res.storage_key).toMatch(/^requests\/shop-1\//);
  });
});
