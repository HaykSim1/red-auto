import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api.exception';

/** Throws unless every key lives under the caller's own inventory prefix. */
export function assertInventoryKeys(
  userId: string,
  keys: readonly string[],
): void {
  const prefix = `inventory/${userId}/`;
  for (const key of keys) {
    if (!key.startsWith(prefix)) {
      throw new ApiException(
        'inventory_photo_key_forbidden',
        'Storage key does not belong to this shop.',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
