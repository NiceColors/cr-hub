const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostnameOf(host: string) {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }
}

/**
 * Pedido feito do próprio computador. O `Host` barra acesso pela rede e DNS
 * rebinding; o `Origin` barra outro site aberto no navegador. Não cobre quem
 * forja o `Host` pela rede, por isso os scripts escutam só em 127.0.0.1.
 */
export function isLocalRequest(req: Request) {
  if (process.env.VERCEL) return false;

  const host = req.headers.get("host");
  const hostname = host ? hostnameOf(host) : null;
  if (!host || !hostname || !LOOPBACK_HOSTNAMES.has(hostname)) return false;

  const origin = req.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
