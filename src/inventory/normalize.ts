export function normalizePartNumber(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** GS1 mod-10: weights 3,1,3,… from the digit left of the check digit. */
function hasValidGs1CheckDigit(digits: string): boolean {
  let sum = 0;
  for (let i = digits.length - 2, w = 3; i >= 0; i--, w = 4 - w) {
    sum += Number(digits[i]) * w;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/**
 * Scanner hints and AI output: a GTIN (EAN-8, UPC-A, EAN-13, GTIN-14) with a
 * valid check digit, else null. A misread or hallucinated number must not
 * reach the duplicate check or the item form.
 */
export function normalizeBarcode(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!GTIN_LENGTHS.has(digits.length)) return null;
  return hasValidGs1CheckDigit(digits) ? digits : null;
}

/**
 * Item DTO barcode typed by the shop: digits only, 8–14 long, no checksum
 * test. Shops label stock with their own (non-GTIN) codes, so the strict
 * normalizeBarcode would silently drop what they typed.
 */
export function digitsOnly8to14(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

export function normalizeOemNumbers(
  list: readonly string[] | null | undefined,
): string[] {
  if (!list) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of list) {
    const normalized = normalizePartNumber(raw);
    if (normalized !== null && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}
