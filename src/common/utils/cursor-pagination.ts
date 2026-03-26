export interface CursorPayload {
  t: string;
  id: string;
}

export function encodeCursor(t: Date, id: string): string {
  const payload: CursorPayload = { t: t.toISOString(), id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): CursorPayload | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const o = JSON.parse(json) as CursorPayload;
    if (!o?.t || !o?.id) return null;
    return o;
  } catch {
    return null;
  }
}
