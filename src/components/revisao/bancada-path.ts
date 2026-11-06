export function bancadaPath(input: {
  prKey: string;
  title?: string;
  url?: string;
  repoSlug?: string;
}) {
  const params = new URLSearchParams();
  params.set("pr", input.prKey);
  if (input.title) params.set("title", input.title);
  if (input.url) params.set("url", input.url);
  if (input.repoSlug) params.set("slug", input.repoSlug);
  return `/revisao?${params.toString()}`;
}

/** `prKey` é `{repoUuid}:{prId}`. O UUID do Bitbucket não contém `:`. */
export function splitPrKey(prKey: string) {
  const index = prKey.lastIndexOf(":");
  if (index <= 0) return null;
  const prId = Number(prKey.slice(index + 1));
  const repoUuid = prKey.slice(0, index);
  if (!repoUuid || !Number.isInteger(prId)) return null;
  return { repoUuid, prId };
}

export function revisaoPath(id: number) {
  return `/revisao?id=${id}`;
}

export function evidenceUrl(reportId: number, evidenceId: number) {
  return `/api/test-reports/item/${reportId}/evidence/${evidenceId}`;
}
