import {
  OTHER_CATEGORY_KEY,
  PART_CATEGORIES,
  categoryPromptLines,
  isKnownCategoryKey,
  leafCategoryKeys,
} from './part-categories';
import { CAR_BRANDS, normalizeMake } from './car-brands';

describe('part categories', () => {
  it('every key is unique and leaf keys are group-prefixed', () => {
    const groups = PART_CATEGORIES.map((g) => g.key);
    const leaves = leafCategoryKeys();
    expect(new Set([...groups, ...leaves]).size).toBe(
      groups.length + leaves.length,
    );
    for (const g of PART_CATEGORIES)
      for (const c of g.children)
        expect(c.key.startsWith(`${g.key}.`)).toBe(true);
  });

  it('every group has an .other leaf and labels in hy/ru/en', () => {
    expect(PART_CATEGORIES).toHaveLength(17);
    for (const g of PART_CATEGORIES) {
      expect(g.children.map((c) => c.key)).toContain(`${g.key}.other`);
      for (const n of [g, ...g.children])
        for (const l of ['hy', 'ru', 'en'] as const)
          expect(n.labels[l].trim().length).toBeGreaterThan(0);
    }
  });

  it('isKnownCategoryKey accepts leaves only', () => {
    expect(isKnownCategoryKey('brakes.pads')).toBe(true);
    expect(isKnownCategoryKey('brakes')).toBe(false);
    expect(isKnownCategoryKey(OTHER_CATEGORY_KEY)).toBe(true);
  });

  it('categoryPromptLines has one line per leaf', () => {
    expect(categoryPromptLines()).toHaveLength(leafCategoryKeys().length);
  });

  it('normalizeMake maps case-insensitively', () => {
    expect(CAR_BRANDS).toContain('Toyota');
    expect(normalizeMake('toyota')).toBe('Toyota');
    expect(normalizeMake('Zaz ')).toBe('Zaz');
  });
});
