import {
  normalizeBarcode,
  normalizeOemNumbers,
  normalizePartNumber,
} from './normalize';

describe('normalizePartNumber', () => {
  it('strips spaces, dashes, dots and lowercases', () => {
    expect(normalizePartNumber('0 986 494 - 0.17a')).toBe('0986494017A');
  });
  it('returns null for empty or symbol-only input', () => {
    expect(normalizePartNumber('  -- ')).toBeNull();
    expect(normalizePartNumber(undefined)).toBeNull();
  });
});
describe('normalizeBarcode', () => {
  it('keeps 8–14 digit codes', () =>
    expect(normalizeBarcode('4 047 024 063303')).toBe('4047024063303'));
  it('rejects too short / too long', () => {
    expect(normalizeBarcode('12345')).toBeNull();
    expect(normalizeBarcode('123456789012345')).toBeNull();
  });
});
describe('normalizeOemNumbers', () => {
  it('normalizes, dedupes and drops empties', () => {
    expect(
      normalizeOemNumbers(['1K0 698 151', '1k0698151', '', '7L0-698-151']),
    ).toEqual(['1K0698151', '7L0698151']);
  });
});
