import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/exceptions/api.exception';
import { assertInventoryKeys } from './storage-keys';

describe('assertInventoryKeys', () => {
  it('accepts keys under the shop prefix', () => {
    expect(() =>
      assertInventoryKeys('u1', ['inventory/u1/a.jpg']),
    ).not.toThrow();
  });

  it.each(['inventory/u2/a.jpg', 'requests/u1/a.jpg', 'inventory/u1x/a.jpg'])(
    'rejects %s',
    (key) => {
      const run = () => assertInventoryKeys('u1', [key]);
      expect(run).toThrow(ApiException);
      try {
        run();
      } catch (e) {
        const err = e as ApiException;
        expect(err.code).toBe('inventory_photo_key_forbidden');
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.message).toBe('Storage key does not belong to this shop.');
      }
    },
  );
});
