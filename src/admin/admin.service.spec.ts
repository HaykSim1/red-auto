// admin.service.ts statically imports PushService, which in turn imports the
// ESM-only `expo-server-sdk` package that ts-jest cannot transform out of the
// box. Mock the module (before importing admin.service) so Jest never has to
// load the real push.service.ts file for this unit test of a pure function.
jest.mock('../push/push.service', () => ({
  PushService: jest.fn(),
}));

import { vehicleLabel } from './admin.service';

describe('AdminService.listRequests', () => {
  it('derives vehicle_label from label when present', () => {
    expect(
      vehicleLabel({
        label: 'My E46',
        brand: 'BMW',
        model: '330i',
        year: 2003,
        engine: 'M54B30',
      }),
    ).toBe('My E46');
  });

  it('composes vehicle_label from parts when label is null', () => {
    expect(
      vehicleLabel({
        label: null,
        brand: 'BMW',
        model: '330i',
        year: 2003,
        engine: 'M54B30',
      }),
    ).toBe('2003 BMW 330i M54B30');
  });

  it('skips null parts when composing', () => {
    expect(
      vehicleLabel({
        label: null,
        brand: 'BMW',
        model: null,
        year: null,
        engine: null,
      }),
    ).toBe('BMW');
  });

  it('returns null when the vehicle is null', () => {
    expect(vehicleLabel(null)).toBeNull();
  });

  it('returns null when every vehicle field is null', () => {
    expect(
      vehicleLabel({
        label: null,
        brand: null,
        model: null,
        year: null,
        engine: null,
      }),
    ).toBeNull();
  });
});
