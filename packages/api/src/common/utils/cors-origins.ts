const DEFAULT_ORIGINS = ['http://localhost:3000'];

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * The origins allowed to call the API, shared by the HTTP server and the
 * WebSocket gateway so the two never drift.
 *
 * FRONTEND_URL lists the UI's own addresses. CORS_ORIGINS optionally adds
 * more, and a `*` in either allows any origin. That returns `true`, which
 * reflects the caller's origin back: a literal `*` header is rejected by
 * browsers on credentialed requests.
 */
export function corsOrigins(env: NodeJS.ProcessEnv = process.env): string[] | true {
  const frontend = parseList(env.FRONTEND_URL);
  const origins = [...(frontend.length ? frontend : DEFAULT_ORIGINS), ...parseList(env.CORS_ORIGINS)];
  if (origins.includes('*')) return true;
  return [...new Set(origins)];
}
