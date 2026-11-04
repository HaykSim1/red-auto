import { CAR_BRANDS } from '../catalog/car-brands';
import {
  OTHER_CATEGORY_KEY,
  categoryPromptLines,
} from '../catalog/part-categories';

let cachedSystemPrompt: string | null = null;

/**
 * Stable system prompt (sent with `cache_control`): any change here
 * invalidates the prompt cache, so keep it deterministic.
 */
export function buildSystemPrompt(): string {
  if (cachedSystemPrompt !== null) return cachedSystemPrompt;
  cachedSystemPrompt = [
    'You identify automotive spare parts for a parts shop in Armenia from photos of the part, its box or its label.',
    'Fill every field of the output schema for the ONE product shown. If the photos show several different products, describe the first one and list the others in notes_for_seller.',
    '',
    'Names: output `name` in Russian, `name_en` in English, `name_hy` in Armenian. Use the common trade name of the part (e.g. "Тормозные колодки передние").',
    '',
    'Numbers:',
    '- brand: the part manufacturer as printed (e.g. Bosch, TRW, Denso), not the car make.',
    '- part_number: the manufacturer part number exactly as printed on the label (keep its spaces and dashes).',
    '- barcode: the EAN/UPC digits only, no spaces; null if no barcode is readable.',
    '- oem_numbers: car-maker (OE) numbers printed on the label or found as cross-references for this part number.',
    '',
    'Fitment: use web search to look up the part number for the vehicles it fits and for OE cross-references.',
    'You must never invent fitment. If you cannot confirm fitment from the label or a reliable source, leave `fitments` empty and put "fitments" into `needs_review`.',
    'fitments[].make must be one of these car brands when it matches one (same spelling): ' +
      CAR_BRANDS.join(', ') +
      '. Otherwise use the make as commonly written.',
    'Put engine codes or volumes in `engine`, years in year_from / year_to (null when unknown), and anything that does not fit these fields (axle, side, VIN range) in fitment_note.',
    '',
    `Category: category_key must be exactly one of the keys below; pick the closest, or ${OTHER_CATEGORY_KEY} if none fits.`,
    ...categoryPromptLines(),
    '',
    'condition: "new" unless the photos clearly show a used part.',
    '',
    'Confidence: give each `confidence` value between 0 and 1 for how sure you are of that field. Put the name of every field with confidence below 0.6 into `needs_review` (field names: brand, part_number, barcode, name, category_key, fitments).',
    'notes_for_seller: short remarks for the shop owner (in Russian), or null.',
  ].join('\n');
  return cachedSystemPrompt;
}

/** Per-request user text: the hints the shop gave alongside the photos. */
export function buildUserText(hints: {
  barcode?: string | null;
  text?: string | null;
}): string {
  const lines = ['Identify the part in these photos.'];
  const barcode = hints.barcode?.trim();
  if (barcode) {
    lines.push(`Barcode scanned from the box: ${barcode}`);
  }
  const text = hints.text?.trim();
  if (text) {
    lines.push(`Note from the shop: ${text}`);
  }
  return lines.join('\n');
}
