import { z } from 'zod';

export const FitmentSchema = z.object({
  make: z.string(),
  model: z.string().nullable(),
  year_from: z.number().nullable(),
  year_to: z.number().nullable(),
  engine: z.string().nullable(),
});

/**
 * Structured output of one recognition, also the shape stored in
 * `inventory_recognitions.result`. Confidences are clamped to 0..1 after
 * parsing (no `.min/.max` here: structured outputs do not support them).
 */
export const RecognitionSchema = z.object({
  brand: z.string().nullable(),
  part_number: z.string().nullable(),
  barcode: z.string().nullable(),
  name: z.string(),
  name_en: z.string().nullable(),
  name_hy: z.string().nullable(),
  category_key: z.string(),
  oem_numbers: z.array(z.string()),
  fitments: z.array(FitmentSchema),
  fitment_note: z.string().nullable(),
  condition: z.enum(['new', 'used']),
  confidence: z.object({
    brand: z.number(),
    part_number: z.number(),
    barcode: z.number(),
    name: z.number(),
    category_key: z.number(),
    fitments: z.number(),
  }),
  needs_review: z.array(z.string()),
  notes_for_seller: z.string().nullable(),
});

export type RecognitionFitment = z.infer<typeof FitmentSchema>;
export type RecognitionResult = z.infer<typeof RecognitionSchema>;
