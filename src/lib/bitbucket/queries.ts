export function buildPullRequestQ(authorUuids: string[]) {
  const uuids = [...new Set(authorUuids)].filter(Boolean);
  if (uuids.length === 0) return `state="OPEN"`;
  const authors = uuids.map((uuid) => `author.uuid="${uuid}"`).join(" OR ");
  return `state="OPEN" AND (${authors})`;
}

