import { isAllowedReturnTo, isValidRedirectUri, SpotifyAuthService } from './spotify-auth.service';

describe('isValidRedirectUri', () => {
  it.each([
    'https://media.example.com/api/music/spotify/callback',
    'https://tunnel.example.com:8443/music/spotify/callback',
    'http://127.0.0.1:3001/music/spotify/callback',
  ])('accepts %s', (uri) => {
    expect(isValidRedirectUri(uri)).toBe(true);
  });

  it.each(['http://192.168.1.10:3001/music/spotify/callback', 'http://localhost:3001/callback', 'not a url', ''])(
    'rejects %p',
    (uri) => {
      expect(isValidRedirectUri(uri)).toBe(false);
    },
  );
});

describe('isAllowedReturnTo', () => {
  const allowed = ['http://localhost:3000', 'https://media.example.com'];

  it('accepts pages on an allowed origin', () => {
    expect(isAllowedReturnTo('https://media.example.com/settings/music', allowed)).toBe(true);
    expect(isAllowedReturnTo('http://localhost:3000/settings/music?x=1', allowed)).toBe(true);
  });

  it('rejects other origins, including look-alikes', () => {
    expect(isAllowedReturnTo('https://evil.example/settings/music', allowed)).toBe(false);
    expect(isAllowedReturnTo('https://media.example.com.evil.example/', allowed)).toBe(false);
    expect(isAllowedReturnTo('http://localhost:3001/', allowed)).toBe(false);
  });

  it('rejects non-web schemes even when any origin is allowed', () => {
    expect(isAllowedReturnTo('javascript:alert(1)', true)).toBe(false);
    expect(isAllowedReturnTo('https://anywhere.example/', true)).toBe(true);
  });
});

describe('SpotifyAuthService', () => {
  const clientId = '0123456789abcdef0123456789abcdef';
  const redirectUri = 'https://media.example.com/api/music/spotify/callback';
  const returnTo = 'http://localhost:3000/settings/music';

  const setup = () => {
    const prisma: any = { musicSource: { upsert: jest.fn(async ({ create }) => create), update: jest.fn() } };
    const spotify: any = {
      exchangeCode: jest.fn(async () => ({ accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(Date.now() + 3600_000) })),
      me: jest.fn(async () => ({ id: 'user1', displayName: 'Chris' })),
      refresh: jest.fn(async () => ({ accessToken: 'at2', expiresAt: new Date(Date.now() + 3600_000) })),
    };
    const service = new SpotifyAuthService(prisma, spotify);
    const stateOf = (authorizeUrl: string) => new URL(authorizeUrl).searchParams.get('state')!;
    return { prisma, spotify, service, stateOf };
  };

  beforeEach(() => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    delete process.env.CORS_ORIGINS;
  });

  it('connects on a successful callback and returns to Settings', async () => {
    const { prisma, spotify, service, stateOf } = setup();
    const { authorizeUrl } = service.start({ clientId, redirectUri, returnTo });
    const result = await service.handleCallback({ code: 'c1', state: stateOf(authorizeUrl) });

    expect(result).toEqual({ url: `${returnTo}?spotify=connected`, connected: true });
    expect(spotify.exchangeCode).toHaveBeenCalledWith(expect.objectContaining({ clientId, code: 'c1', redirectUri }));
    expect(prisma.musicSource.upsert.mock.calls[0][0].create).toMatchObject({
      provider: 'SPOTIFY',
      username: 'user1',
      displayName: 'Chris',
      refreshToken: 'rt',
    });
  });

  it('only accepts each state once', async () => {
    const { service, stateOf } = setup();
    const state = stateOf(service.start({ clientId, redirectUri, returnTo }).authorizeUrl);
    await service.handleCallback({ code: 'c1', state });
    await expect(service.handleCallback({ code: 'c1', state })).rejects.toThrow(/expired or was already used/);
  });

  it('reports a declined login back to Settings', async () => {
    const { prisma, service, stateOf } = setup();
    const state = stateOf(service.start({ clientId, redirectUri, returnTo }).authorizeUrl);
    const result = await service.handleCallback({ error: 'access_denied', state });
    expect(result.connected).toBe(false);
    expect(new URL(result.url).searchParams.get('message')).toBe('Spotify access was declined');
    expect(prisma.musicSource.upsert).not.toHaveBeenCalled();
  });

  it('reports a failed token exchange back to Settings', async () => {
    const { spotify, service, stateOf } = setup();
    spotify.exchangeCode.mockRejectedValue(new Error('Spotify: Invalid redirect URI'));
    const state = stateOf(service.start({ clientId, redirectUri, returnTo }).authorizeUrl);
    const result = await service.handleCallback({ code: 'c1', state });
    expect(result.connected).toBe(false);
    expect(new URL(result.url).searchParams.get('message')).toBe('Spotify: Invalid redirect URI');
  });

  it('refuses return addresses outside the allowed origins', () => {
    const { service } = setup();
    expect(() => service.start({ clientId, redirectUri, returnTo: 'https://evil.example/' })).toThrow(/allowed/);
  });

  it('refuses bad client IDs and non-HTTPS redirects', () => {
    const { service } = setup();
    expect(() => service.start({ clientId: 'nope', redirectUri, returnTo })).toThrow(/Client ID/);
    expect(() => service.start({ clientId, redirectUri: 'http://192.168.1.2:3001/x', returnTo })).toThrow(/https/);
  });

  it('refreshes an expired token and keeps the old refresh token if none is returned', async () => {
    const { prisma, spotify, service } = setup();
    const source: any = { id: 's1', clientId, accessToken: 'old', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() - 1000) };
    await expect(service.accessToken(source)).resolves.toBe('at2');
    expect(spotify.refresh).toHaveBeenCalledWith(clientId, 'rt');
    expect(prisma.musicSource.update.mock.calls[0][0].data).toMatchObject({ accessToken: 'at2', refreshToken: 'rt' });
  });

  it('reuses a token that is still fresh', async () => {
    const { spotify, service } = setup();
    const source: any = { id: 's1', clientId, accessToken: 'live', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() + 600_000) };
    await expect(service.accessToken(source)).resolves.toBe('live');
    expect(spotify.refresh).not.toHaveBeenCalled();
  });
});
