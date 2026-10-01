const DEFAULT_ORIGINS = ['http://localhost:3000'];

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * The other origins allowed to call the API, shared by the HTTP server and the
 * WebSocket gateway so the two never drift. The UI is served from the API's
 * own origin and needs none; the default is the Vite dev server.
 *
 * FRONTEND_URL and CORS_ORIGINS both list origins (the first predates the UI
 * being served from here), and a `*` in either allows any origin. That returns `true`, which
 * reflects the caller's origin back: a literal `*` header is rejected by
 * browsers on credentialed requests.
 */
export function corsOrigins(env: NodeJS.ProcessEnv = process.env): string[] | true {
  const frontend = parseList(env.FRONTEND_URL);
  const origins = [...(frontend.length ? frontend : DEFAULT_ORIGINS), ...parseList(env.CORS_ORIGINS)];
  if (origins.includes('*')) return true;
  return [...new Set(origins)];
}
