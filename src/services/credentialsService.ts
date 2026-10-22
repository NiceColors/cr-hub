import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bitbucketCredentials } from "@/lib/db/schema";
import { BitbucketHttpError, checkCredentials } from "@/lib/bitbucket/client";
import {
  maskToken,
  resolveCredentials,
  setStoredCredentials,
  type BitbucketCredentials,
} from "@/lib/bitbucket/credentials";
import { clearPullRequestsCache } from "@/lib/pullRequestsCache";
import { resetTokenStatus } from "@/lib/tokenStatus";
import {
  CREDENTIALS_ROW_ID,
  ensureStoredCredentialsLoaded,
} from "@/services/storedCredentials";

export function getCredentialsSummary() {
  ensureStoredCredentialsLoaded();
  const { credentials, source } = resolveCredentials();
  return {
    source,
    workspace: credentials?.workspace ?? null,
    email: credentials?.email ?? null,
    tokenHint: credentials ? maskToken(credentials.apiToken) : null,
  };
}

export class CredentialsRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialsRejectedError";
  }
}

function rejectionMessage(err: BitbucketHttpError, workspace: string) {
  if (err.status === 401) return "O Bitbucket recusou o e-mail ou o token (401).";
  if (err.status === 403)
    return "O token não tem permissão para ler os repositórios do workspace (403).";
  if (err.status === 404) return `Workspace "${workspace}" não encontrado (404).`;
  if (err.status === 429) return "Limite da API do Bitbucket atingido. Tente de novo em instantes.";
  return `O Bitbucket respondeu ${err.status} ao validar as credenciais.`;
}

function onCredentialsChanged() {
  clearPullRequestsCache();
  resetTokenStatus();
}

/** `apiToken` vazio mantém o token em uso, para trocar só workspace ou e-mail. */
export async function saveCredentials(input: {
  workspace: string;
  email: string;
  apiToken: string | null;
}) {
  ensureStoredCredentialsLoaded();
  const apiToken = input.apiToken || resolveCredentials().credentials?.apiToken;
  if (!apiToken) throw new CredentialsRejectedError("Informe o token do Bitbucket.");

  const next: BitbucketCredentials = {
    workspace: input.workspace,
    email: input.email,
    apiToken,
  };

  try {
    await checkCredentials(next);
  } catch (err) {
    if (err instanceof BitbucketHttpError) {
      throw new CredentialsRejectedError(rejectionMessage(err, next.workspace));
    }
    throw err;
  }

  const row = { ...next, updatedAt: new Date() };
  db.insert(bitbucketCredentials)
    .values({ id: CREDENTIALS_ROW_ID, ...row })
    .onConflictDoUpdate({ target: bitbucketCredentials.id, set: row })
    .run();
  setStoredCredentials(next);
  onCredentialsChanged();
}

export function clearStoredCredentials() {
  db.delete(bitbucketCredentials).where(eq(bitbucketCredentials.id, CREDENTIALS_ROW_ID)).run();
  setStoredCredentials(null);
  onCredentialsChanged();
}
