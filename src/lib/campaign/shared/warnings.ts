export function uniqueWarnings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function stageLocalWarnings(allWarnings: string[], inheritedWarnings: string[]) {
  const inherited = new Set(uniqueWarnings(inheritedWarnings));

  return uniqueWarnings(allWarnings).filter((warning) => !inherited.has(warning));
}
