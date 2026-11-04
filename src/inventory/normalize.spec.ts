import {
  digitsOnly8to14,
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
  // 4047024063303 has a valid GS1 check digit (sum 57 → 3).
  it('keeps a valid EAN-13, stripping separators', () => {
    expect(normalizeBarcode('4 047 024 063303')).toBe('4047024063303');
    expect(normalizeBarcode('4006381333931')).toBe('4006381333931');
  });
  it('accepts valid EAN-8, UPC-A and GTIN-14', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074');
    expect(normalizeBarcode('036000291452')).toBe('036000291452');
    expect(normalizeBarcode('10036000291459')).toBe('10036000291459');
  });
  it('rejects a wrong check digit', () => {
    expect(normalizeBarcode('4006381333932')).toBeNull();
    expect(normalizeBarcode('96385075')).toBeNull();
  });
  it('rejects lengths other than 8, 12, 13, 14 (e.g. a code128 number)', () => {
    expect(normalizeBarcode('1234567890')).toBeNull();
    expect(normalizeBarcode('12345')).toBeNull();
    expect(normalizeBarcode('123456789012345')).toBeNull();
    expect(normalizeBarcode(null)).toBeNull();
  });
});
describe('digitsOnly8to14', () => {
  it('keeps any 8–14 digit string without a checksum test', () => {
    expect(digitsOnly8to14('12-345-678-90')).toBe('1234567890');
    expect(digitsOnly8to14('4006381333932')).toBe('4006381333932');
  });
  it('returns null outside 8–14 digits', () => {
    expect(digitsOnly8to14('1234567')).toBeNull();
    expect(digitsOnly8to14('123456789012345')).toBeNull();
    expect(digitsOnly8to14(undefined)).toBeNull();
  });
});
describe('normalizeOemNumbers', () => {
  it('normalizes, dedupes and drops empties', () => {
    expect(
      normalizeOemNumbers(['1K0 698 151', '1k0698151', '', '7L0-698-151']),
    ).toEqual(['1K0698151', '7L0698151']);
  });
});
