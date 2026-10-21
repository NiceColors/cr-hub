function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function buildOpenPrQuery(authorUuids: string[]) {
  const uuids = [...new Set(authorUuids)].filter(Boolean);
  if (uuids.length === 0) return `state="OPEN"`;
  const authors = uuids.map((uuid) => `author.uuid="${uuid}"`).join(" OR ");
  return `state="OPEN" AND (${authors})`;
}

export function buildOpenPrQueryBatches(authorUuids: string[], batchSize = 25) {
  const uuids = [...new Set(authorUuids)].filter(Boolean);
  return chunk(uuids, batchSize).map((c) => buildOpenPrQuery(c));
}

