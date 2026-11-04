/** Canonical car brand names (copied from mobile/lib/car-catalog.ts). */
export const CAR_BRANDS: readonly string[] = [
  'Audi',
  'BMW',
  'Chevrolet',
  'Citroën',
  'Dacia',
  'Fiat',
  'Ford',
  'Honda',
  'Hyundai',
  'Kia',
  'Lada',
  'Land Rover',
  'Lexus',
  'Mazda',
  'Mercedes-Benz',
  'Mitsubishi',
  'Nissan',
  'Opel',
  'Peugeot',
  'Porsche',
  'Renault',
  'Skoda',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Volkswagen',
  'Volvo',
];

/** Case-insensitive exact match -> canonical name, else the trimmed input. */
export function normalizeMake(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  return CAR_BRANDS.find((b) => b.toLowerCase() === lower) ?? t;
}
