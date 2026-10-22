export type BitbucketCredentials = {
  workspace: string;
  email: string;
  apiToken: string;
};

export type CredentialsSource = "database" | "env" | "none";

declare global {
  var __crTrackerStoredCredentials: BitbucketCredentials | null | undefined;
}

/** Credenciais salvas pela interface; `null` limpa e volta a valer o `.env`. */
export function setStoredCredentials(credentials: BitbucketCredentials | null) {
  globalThis.__crTrackerStoredCredentials = credentials;
}

export function hasLoadedStoredCredentials() {
  return globalThis.__crTrackerStoredCredentials !== undefined;
}

function readEnvCredentials(): BitbucketCredentials | null {
  const workspace = process.env.BITBUCKET_WORKSPACE;
  const email = process.env.BITBUCKET_EMAIL;
  const apiToken = process.env.BITBUCKET_API_TOKEN;
  if (!workspace || !email || !apiToken) return null;
  return { workspace, email, apiToken };
}

export function resolveCredentials(): {
  credentials: BitbucketCredentials | null;
  source: CredentialsSource;
} {
  const stored = globalThis.__crTrackerStoredCredentials;
  if (stored) return { credentials: stored, source: "database" };
  const env = readEnvCredentials();
  if (env) return { credentials: env, source: "env" };
  return { credentials: null, source: "none" };
}

/** Últimos 4 caracteres, para a interface confirmar qual token está em uso. */
export function maskToken(token: string) {
  return token.length >= 12 ? `••••${token.slice(-4)}` : "••••";
}
