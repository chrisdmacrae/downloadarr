// Cloudflare Access puts its session JWT in the CF_Authorization cookie on the
// UI's hostname. When the API sits on another origin (VITE_API_URL), that
// cookie only rides along on credentialed requests, and not at all if the API
// hostname is outside the cookie's domain. Access also accepts the token in
// the cf-access-token header, so send it there too whenever it's readable
// (it isn't when the Access app marks the cookie HttpOnly).
export const CLOUDFLARE_ACCESS_COOKIE = 'CF_Authorization';
export const CLOUDFLARE_ACCESS_HEADER = 'cf-access-token';

export const getCloudflareAccessToken = (): string | undefined => {
  if (typeof document === 'undefined') return undefined;

  const prefix = `${CLOUDFLARE_ACCESS_COOKIE}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
};

export const cloudflareAccessHeaders = (): Record<string, string> => {
  const token = getCloudflareAccessToken();
  return token ? { [CLOUDFLARE_ACCESS_HEADER]: token } : {};
};

// fetch() counterpart of the axios client's withCredentials + interceptor.
export const withCloudflareAccess = (init: RequestInit = {}): RequestInit => ({
  ...init,
  credentials: 'include',
  headers: { ...cloudflareAccessHeaders(), ...init.headers },
});
