import { resolveCredentials } from "@/lib/bitbucket/credentials";
import { bitbucketClient } from "@/services/bitbucketClient";

export type Me = { uuid: string; displayName: string; avatarUrl: string | null };

declare global {
  var __crTrackerMe: { key: string; me: Me } | undefined;
  var __crTrackerMeInFlight: { key: string; promise: Promise<Me> } | undefined;
}

/** Identifica as credenciais em uso, para não reaproveitar o usuário de um token trocado. */
function credentialsKey() {
  const { credentials } = resolveCredentials();
  return credentials ? `${credentials.workspace}|${credentials.email}|${credentials.apiToken.slice(-6)}` : "";
}

/** Usuário dono do token. Busca `/user` uma vez por credencial; falhas não ficam em cache. */
export async function getMe(): Promise<Me> {
  const key = credentialsKey();
  const cached = globalThis.__crTrackerMe;
  if (cached?.key === key) return cached.me;

  const inFlight = globalThis.__crTrackerMeInFlight;
  if (inFlight?.key === key) return inFlight.promise;

  const promise = bitbucketClient
    .getCurrentUser()
    .then((user) => {
      const me: Me = {
        uuid: user.uuid,
        displayName: user.display_name ?? user.nickname ?? user.uuid,
        avatarUrl: user.links?.avatar?.href ?? null,
      };
      globalThis.__crTrackerMe = { key, me };
      return me;
    })
    .finally(() => {
      if (globalThis.__crTrackerMeInFlight?.promise === promise) {
        globalThis.__crTrackerMeInFlight = undefined;
      }
    });
  globalThis.__crTrackerMeInFlight = { key, promise };
  return promise;
}

/** Esquece o usuário em cache; chamado quando as credenciais mudam. */
export function clearMe() {
  globalThis.__crTrackerMe = undefined;
  globalThis.__crTrackerMeInFlight = undefined;
}

/** Versão tolerante a falhas, para quem só usa a identidade como complemento. */
export async function tryGetMe(): Promise<Me | null> {
  try {
    return await getMe();
  } catch {
    return null;
  }
}
