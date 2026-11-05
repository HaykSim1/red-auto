/**
 * Part category taxonomy, loaded from the owner's tree.
 * The owner edits `docs/parts-taxonomy.json` (repo root); copy it here byte-for-byte.
 *
 * Key = dot-joined slugs of the English names along the path
 * (`car_parts.braking_systems.brake_pads_and_shoes`). A leaf is any node
 * without children (depth 1, 2 or 3); only leaf keys are valid item keys.
 * Labels: `am` → `hy`; an empty `am` falls back to the Russian label.
 */
import taxonomy from './parts-taxonomy.json';

export type CategoryLabels = { hy: string; ru: string; en: string };

export interface PartCategoryNode {
  key: string;
  labels: CategoryLabels;
  children: PartCategoryNode[];
}

interface RawNode {
  name: { en: string; ru: string; am: string };
  children: RawNode[];
}

export const OTHER_CATEGORY_KEY = 'car_parts.everything_else';

/** lowercase, `&`→`and`, `/`→`_`, other non-`[a-z0-9]` runs → `_`, trimmed. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\//g, '_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function build(raw: RawNode[], parentKey: string | null): PartCategoryNode[] {
  const seen = new Set<string>();
  return raw.map((r) => {
    const slug = slugify(r.name.en);
    if (!slug || seen.has(slug)) {
      throw new Error(`parts-taxonomy: bad or duplicate slug "${slug}"`);
    }
    seen.add(slug);
    const key = parentKey ? `${parentKey}.${slug}` : slug;
    return {
      key,
      labels: {
        hy: r.name.am?.trim() || r.name.ru,
        ru: r.name.ru,
        en: r.name.en,
      },
      children: build(r.children ?? [], key),
    };
  });
}

/** The top-level sections, built once at import. */
export const PART_CATEGORIES: readonly PartCategoryNode[] = build(
  (taxonomy as { children: RawNode[] }).children,
  null,
);

const BY_KEY = new Map<string, PartCategoryNode[]>();
(function index(nodes: readonly PartCategoryNode[], path: PartCategoryNode[]) {
  for (const n of nodes) {
    const p = [...path, n];
    BY_KEY.set(n.key, p);
    index(n.children, p);
  }
})(PART_CATEGORIES, []);

const LEAF_KEYS = [...BY_KEY.values()]
  .map((p) => p[p.length - 1])
  .filter((n) => n.children.length === 0)
  .map((n) => n.key);
const LEAF_SET = new Set(LEAF_KEYS);

if (!LEAF_SET.has(OTHER_CATEGORY_KEY)) {
  throw new Error(`parts-taxonomy: ${OTHER_CATEGORY_KEY} is not a leaf`);
}

export function leafCategoryKeys(): string[] {
  return [...LEAF_KEYS];
}

/** True only for leaf keys (the values an item may carry). */
export function isKnownCategoryKey(key: string): boolean {
  return LEAF_SET.has(key);
}

export function findCategory(
  key: string,
): { node: PartCategoryNode; path: PartCategoryNode[] } | null {
  const path = BY_KEY.get(key);
  return path ? { node: path[path.length - 1], path: [...path] } : null;
}

/** One line per leaf, for the recognition prompt. */
export function categoryPromptLines(): string[] {
  return LEAF_KEYS.map((key) => {
    const path = BY_KEY.get(key)!;
    const en = path.map((n) => n.labels.en).join(' / ');
    const ru = path.map((n) => n.labels.ru).join(' / ');
    return `${key} — ${en} (${ru})`;
  });
}
