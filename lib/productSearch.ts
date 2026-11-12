import { pinyin } from "pinyin-pro";

export type SearchableProduct = {
  sku?: string | null;
  brand?: string | null;
  product_name_cn?: string | null;
  product_name_en?: string | null;
  display_name?: string | null;
};
export type ProductSearchIndex = {
  sku: string[];
  raw: string[];
  literal: string[];
  phonetic: string[];
  initials: string[];
  approximate: string[];
};

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/u:|[üǖǘǚǜ]/g, "v")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
const distinct = (values: string[]) => [...new Set(values.filter(Boolean))];
const compactSku = (value: string) => value.replace(/0+(?=\d)/g, "");

export function buildProductSearchIndex(
  product: SearchableProduct,
  extraFields: string[] = [],
): ProductSearchIndex {
  const raw = [
    product.sku,
    product.brand,
    product.product_name_cn,
    product.product_name_en,
    product.display_name,
    ...extraFields,
  ]
    .filter((field): field is string => Boolean(field))
    .map((field) => field.normalize("NFKC").toLowerCase());
  const literal = distinct(raw.map(normalizeSearchText));
  const phonetic: string[] = [],
    initials: string[] = [],
    approximate: string[] = [];
  for (const field of raw) {
    const words = field.match(/[\p{L}\p{N}]+/gu) || [];
    const syllables = pinyin(field, {
      type: "array",
      toneType: "none",
      nonZh: "consecutive",
      v: true,
    })
      .flatMap((part) => part.match(/[\p{L}\p{N}]+/gu) || [])
      .map(normalizeSearchText);
    if (/\p{Script=Han}/u.test(field)) phonetic.push(syllables.join(""));
    initials.push(syllables.map((part) => part[0] || "").join(""));
    approximate.push(...words.map(normalizeSearchText));
  }
  const sku = normalizeSearchText(product.sku || "");
  return {
    sku: distinct([sku, compactSku(sku)]),
    raw,
    literal,
    phonetic: distinct(phonetic),
    initials: distinct(initials),
    approximate: distinct([...literal, ...phonetic, ...approximate]),
  };
}

// A bounded edit comparison: one missing, extra, replaced, or adjacent-swapped character.
function oneEditAway(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  if (a.length === b.length) {
    const differences: number[] = [];
    for (let i = 0; i < a.length; i++)
      if (a[i] !== b[i]) {
        differences.push(i);
        if (differences.length > 2) return false;
      }
    if (differences.length === 1) return true;
    const [first, second] = differences;
    return (
      second === first + 1 && a[first] === b[second] && a[second] === b[first]
    );
  }
  const shorter = a.length < b.length ? a : b,
    longer = a.length < b.length ? b : a;
  let left = 0,
    right = 0,
    skipped = false;
  while (left < shorter.length && right < longer.length) {
    if (shorter[left] === longer[right]) {
      left++;
      right++;
    } else {
      if (skipped) return false;
      skipped = true;
      right++;
    }
  }
  return true;
}

function approximateSubstring(text: string, query: string) {
  for (const length of [query.length - 1, query.length, query.length + 1]) {
    if (length > text.length) continue;
    for (let start = 0; start + length <= text.length; start++) {
      if (oneEditAway(text.slice(start, start + length), query)) return true;
    }
  }
  return false;
}

function omittedChineseCharacters(text: string, query: string) {
  if (!/^[\p{Script=Han}]{2,}$/u.test(query)) return false;
  // Limit the span so unrelated words far apart do not become a match.
  for (
    let start = text.indexOf(query[0]);
    start >= 0;
    start = text.indexOf(query[0], start + 1)
  ) {
    let at = start;
    for (const character of query) {
      at = text.indexOf(character, at);
      if (at < 0) break;
      at++;
    }
    if (at >= 0 && at - start <= query.length * 2 + 2) return true;
  }
  return false;
}

function scoreTerm(index: ProductSearchIndex, query: string) {
  if (!query) return 0;
  if (index.sku.includes(query) || index.sku.includes(compactSku(query)))
    return 1000;
  if (index.literal.some((field) => field === query)) return 900;
  if (index.literal.some((field) => field.startsWith(query))) return 800;
  if (index.literal.some((field) => field.includes(query))) return 700;
  if (index.sku.some((field) => field.includes(query))) return 650;
  if (index.phonetic.some((field) => field === query)) return 600;
  if (index.phonetic.some((field) => field.includes(query))) return 550;
  if (
    query.length >= 2 &&
    index.initials.some((field) => field.includes(query))
  )
    return 450;
  if (index.literal.some((field) => omittedChineseCharacters(field, query)))
    return 300;
  // Never fuzz numbers/SKUs, or short letter fragments, into a different product.
  if (
    (/^[a-z]{4,64}$/.test(query) || /^[\p{Script=Han}]{3,24}$/u.test(query)) &&
    index.approximate.some((field) => approximateSubstring(field, query))
  )
    return 200;
  return 0;
}

export function scoreProductSearch(
  index: ProductSearchIndex,
  input: string,
): number {
  const raw = input.normalize("NFKC").toLowerCase().trim();
  if (!raw) return 1;
  const query = normalizeSearchText(raw);
  if (!query) return index.raw.some((field) => field.includes(raw)) ? 700 : 0;
  let score = scoreTerm(index, query);
  const terms = raw.split(/\s+/).map(normalizeSearchText).filter(Boolean);
  if (terms.length > 1 && !terms.every((term) => /^[a-z]$/.test(term))) {
    const scores = terms.map((term) => scoreTerm(index, term));
    if (scores.every((value) => value > 0))
      score = Math.max(score, Math.min(...scores) - 10);
  }
  return score;
}
