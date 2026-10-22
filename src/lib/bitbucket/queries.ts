function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function buildOpenPrQuery(authorUuids: string[], reviewerUuid?: string | null) {
  const uuids = [...new Set(authorUuids)].filter(Boolean);
  const clauses = uuids.map((uuid) => `author.uuid="${uuid}"`);
  if (reviewerUuid) clauses.push(`reviewers.uuid="${reviewerUuid}"`);
  if (clauses.length === 0) return `state="OPEN"`;
  return `state="OPEN" AND (${clauses.join(" OR ")})`;
}

export function buildOpenPrQueryBatches(
  authorUuids: string[],
  batchSize = 25,
  reviewerUuid?: string | null,
) {
  const uuids = [...new Set(authorUuids)].filter(Boolean);
  if (uuids.length === 0) return reviewerUuid ? [buildOpenPrQuery([], reviewerUuid)] : [];
  return chunk(uuids, batchSize).map((c) => buildOpenPrQuery(c, reviewerUuid));
}
