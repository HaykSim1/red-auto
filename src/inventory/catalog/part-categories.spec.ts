import {
  OTHER_CATEGORY_KEY,
  PART_CATEGORIES,
  PartCategoryNode,
  categoryPromptLines,
  findCategory,
  isKnownCategoryKey,
  leafCategoryKeys,
  slugify,
} from './part-categories';
import { CAR_BRANDS, normalizeMake } from './car-brands';

function allNodes(nodes: readonly PartCategoryNode[]): PartCategoryNode[] {
  return nodes.flatMap((n) => [n, ...allNodes(n.children)]);
}

describe('part categories', () => {
  it('loads the 9 sections of the owner taxonomy', () => {
    expect(PART_CATEGORIES.map((s) => s.key)).toEqual([
      'car_parts',
      'wheels_and_tires',
      'car_accessories',
      'rims_and_hub_caps',
      'car_audio',
      'oils_and_chemicals',
      'car_electronics',
      'car_batteries',
      'gas_equipment',
    ]);
  });

  it('has 190 unique nodes and 168 leaves, child keys prefixed by parent', () => {
    const nodes = allNodes(PART_CATEGORIES);
    expect(nodes).toHaveLength(190);
    expect(new Set(nodes.map((n) => n.key)).size).toBe(190);
    expect(leafCategoryKeys()).toHaveLength(168);
    for (const n of nodes) {
      expect(n.key.length).toBeLessThanOrEqual(120);
      for (const c of n.children)
        expect(c.key.startsWith(`${n.key}.`)).toBe(true);
    }
  });

  it('every node has hy/ru/en labels', () => {
    for (const n of allNodes(PART_CATEGORIES))
      for (const l of ['hy', 'ru', 'en'] as const)
        expect(n.labels[l].trim().length).toBeGreaterThan(0);
  });

  it('an empty Armenian label falls back to Russian', () => {
    // `Springs` has an empty `am` in parts-taxonomy.json.
    const springs = PART_CATEGORIES.flatMap((s) => s.children)
      .flatMap((g) => g.children)
      .find((n) => n.labels.en === 'Springs');
    expect(springs?.labels.hy).toBe(springs?.labels.ru);
  });

  it('slugify follows the key rule', () => {
    expect(slugify('Car Parts')).toBe('car_parts');
    expect(slugify('Wheels & Tires')).toBe('wheels_and_tires');
    expect(slugify('A/C Compressors and Condensers')).toBe(
      'a_c_compressors_and_condensers',
    );
    expect(slugify('  Brake Pads, and Shoes!  ')).toBe('brake_pads_and_shoes');
  });

  it('isKnownCategoryKey accepts leaves at any depth only', () => {
    expect(
      isKnownCategoryKey('car_parts.braking_systems.brake_pads_and_shoes'),
    ).toBe(true);
    expect(isKnownCategoryKey('car_audio.everything_else')).toBe(true);
    expect(isKnownCategoryKey('car_batteries')).toBe(true);
    expect(isKnownCategoryKey('car_parts')).toBe(false);
    expect(isKnownCategoryKey('car_parts.braking_systems')).toBe(false);
    expect(isKnownCategoryKey('brakes.pads')).toBe(false);
  });

  it('OTHER_CATEGORY_KEY is a leaf', () => {
    expect(OTHER_CATEGORY_KEY).toBe('car_parts.everything_else');
    expect(isKnownCategoryKey(OTHER_CATEGORY_KEY)).toBe(true);
  });

  it('findCategory returns the node and its path', () => {
    const found = findCategory(
      'car_parts.braking_systems.brake_pads_and_shoes',
    );
    expect(found?.node.labels.ru).toBe('Тормозные колодки');
    expect(found?.path.map((n) => n.key)).toEqual([
      'car_parts',
      'car_parts.braking_systems',
      'car_parts.braking_systems.brake_pads_and_shoes',
    ]);
    expect(findCategory('car_parts')?.path).toHaveLength(1);
    expect(findCategory('nope')).toBeNull();
  });

  it('categoryPromptLines has one line per leaf with en and ru paths', () => {
    const lines = categoryPromptLines();
    expect(lines).toHaveLength(168);
    expect(lines).toContain(
      'car_parts.braking_systems.brake_pads_and_shoes — Car Parts / Braking Systems / Brake Pads and Shoes (Автозапчасти / Тормозные системы / Тормозные колодки)',
    );
  });

  it('normalizeMake maps case-insensitively', () => {
    expect(CAR_BRANDS).toContain('Toyota');
    expect(normalizeMake('toyota')).toBe('Toyota');
    expect(normalizeMake('Zaz ')).toBe('Zaz');
  });
});
