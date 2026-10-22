import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bitbucketCredentials } from "@/lib/db/schema";
import { hasLoadedStoredCredentials, setStoredCredentials } from "@/lib/bitbucket/credentials";

export const CREDENTIALS_ROW_ID = 1;

/** Carrega uma vez por processo; sem a migration aplicada, vale só o `.env`. */
export function ensureStoredCredentialsLoaded() {
  if (hasLoadedStoredCredentials()) return;
  try {
    const row = db
      .select()
      .from(bitbucketCredentials)
      .where(eq(bitbucketCredentials.id, CREDENTIALS_ROW_ID))
      .get();
    setStoredCredentials(
      row ? { workspace: row.workspace, email: row.email, apiToken: row.apiToken } : null,
    );
  } catch (err) {
    console.warn(
      "[credentials] não foi possível ler as credenciais salvas; rode `npm run db:migrate`.",
      err instanceof Error ? err.message : err,
    );
    setStoredCredentials(null);
  }
}
