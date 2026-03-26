const AM_PHONE = /^\+374\d{8}$/;

export function assertArmeniaE164(phone: string): void {
  const t = phone?.trim();
  if (!t || !AM_PHONE.test(t)) {
    throw new Error('invalid_phone');
  }
}

export function isValidArmeniaE164(phone: string): boolean {
  return AM_PHONE.test(phone?.trim() ?? '');
}
