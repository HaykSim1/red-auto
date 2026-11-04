export function normalizePartNumber(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeBarcode(
  raw: string | null | undefined,
): string | null {
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
