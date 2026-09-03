export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function tokenize(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function countKeywordMatches(text: string, keywords: string[]) {
  return keywords.reduce((total, keyword) => (text.includes(keyword) ? total + 1 : total), 0);
}
