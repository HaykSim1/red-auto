import { ApiException } from '../common/exceptions/api.exception';
import { assertInventoryKeys } from './storage-keys';

describe('assertInventoryKeys', () => {
  it('accepts keys under the shop prefix', () => {
    expect(() =>
      assertInventoryKeys('u1', ['inventory/u1/a.jpg']),
    ).not.toThrow();
  });

  it.each(['inventory/u2/a.jpg', 'requests/u1/a.jpg'])('rejects %s', (key) => {
    try {
      assertInventoryKeys('u1', [key]);
      throw new Error('did not throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiException);
      expect((e as ApiException).code).toBe('inventory_photo_key_forbidden');
    }
  });
});
