import { isAllowedReturnTo, isValidRedirectUri, SpotifyAuthService } from './spotify-auth.service';

describe('isValidRedirectUri', () => {
  it.each([
    'https://media.example.com/api/v1/music/spotify/callback',
    'https://tunnel.example.com:8443/api/v1/music/spotify/callback',
    'http://127.0.0.1:3001/api/v1/music/spotify/callback',
  ])('accepts %s', (uri) => {
    expect(isValidRedirectUri(uri)).toBe(true);
  });

  it.each(['http://192.168.1.10:3001/api/v1/music/spotify/callback', 'http://localhost:3001/callback', 'not a url', ''])(
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

  it('accepts the origin the callback is on, where the UI is served', () => {
    const callback = 'https://tunnel.example.com/api/v1/music/spotify/callback';
    expect(isAllowedReturnTo('https://tunnel.example.com/settings/music', allowed, callback)).toBe(true);
    expect(isAllowedReturnTo('https://evil.example/settings/music', allowed, callback)).toBe(false);
  });

  it('rejects non-web schemes even when any origin is allowed', () => {
    expect(isAllowedReturnTo('javascript:alert(1)', true)).toBe(false);
    expect(isAllowedReturnTo('https://anywhere.example/', true)).toBe(true);
  });
});

describe('SpotifyAuthService', () => {
  const clientId = '0123456789abcdef0123456789abcdef';
  const redirectUri = 'https://media.example.com/api/v1/music/spotify/callback';
  const returnTo = 'http://localhost:3000/settings/recommendations';
  const profileId = 'p1';

  const setup = (apps: Record<string, string | null> = { spotifyClientId: clientId, spotifyRedirectUri: redirectUri }) => {
    const prisma: any = {
      recommendationSource: { upsert: jest.fn(async ({ create }) => create), update: jest.fn() },
      recommendationProfile: { findUnique: jest.fn(async ({ where }) => (where.id === profileId ? { id: profileId } : null)) },
    };
    const spotify: any = {
      exchangeCode: jest.fn(async () => ({ accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(Date.now() + 3600_000) })),
      me: jest.fn(async () => ({ id: 'user1', displayName: 'Chris' })),
      refresh: jest.fn(async () => ({ accessToken: 'at2', expiresAt: new Date(Date.now() + 3600_000) })),
    };
    const appsService: any = { get: jest.fn(async () => apps) };
    const service = new SpotifyAuthService(prisma, spotify, appsService);
    const stateOf = (authorizeUrl: string) => new URL(authorizeUrl).searchParams.get('state')!;
    const start = async (overrides: Partial<{ profileId: string; returnTo: string }> = {}) =>
      stateOf((await service.start({ profileId, returnTo, ...overrides })).authorizeUrl);
    return { prisma, spotify, service, start };
  };

  beforeEach(() => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    delete process.env.CORS_ORIGINS;
  });

  it('connects the profile on a successful callback and returns to Settings', async () => {
    const { prisma, spotify, service, start } = setup();
    const result = await service.handleCallback({ code: 'c1', state: await start() });

    expect(result).toEqual({ url: `${returnTo}?spotify=connected`, connected: true, profileId });
    expect(spotify.exchangeCode).toHaveBeenCalledWith(expect.objectContaining({ clientId, code: 'c1', redirectUri }));
    const call = prisma.recommendationSource.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ profileId_provider: { profileId, provider: 'SPOTIFY' } });
    expect(call.create).toMatchObject({ profileId, provider: 'SPOTIFY', username: 'user1', displayName: 'Chris', refreshToken: 'rt' });
  });

  it('only accepts each state once', async () => {
    const { service, start } = setup();
    const state = await start();
    await service.handleCallback({ code: 'c1', state });
    await expect(service.handleCallback({ code: 'c1', state })).rejects.toThrow(/expired or was already used/);
  });

  it('reports a declined login back to Settings', async () => {
    const { prisma, service, start } = setup();
    const result = await service.handleCallback({ error: 'access_denied', state: await start() });
    expect(result.connected).toBe(false);
    expect(new URL(result.url).searchParams.get('message')).toBe('Spotify access was declined');
    expect(prisma.recommendationSource.upsert).not.toHaveBeenCalled();
  });

  it('reports a failed token exchange back to Settings', async () => {
    const { spotify, service, start } = setup();
    spotify.exchangeCode.mockRejectedValue(new Error('Spotify: Invalid redirect URI'));
    const result = await service.handleCallback({ code: 'c1', state: await start() });
    expect(result.connected).toBe(false);
    expect(new URL(result.url).searchParams.get('message')).toBe('Spotify: Invalid redirect URI');
  });

  it('refuses return addresses outside the allowed origins', async () => {
    const { start } = setup();
    await expect(start({ returnTo: 'https://evil.example/' })).rejects.toThrow(/allowed/);
  });

  it('refuses unknown profiles', async () => {
    const { start } = setup();
    await expect(start({ profileId: 'nope' })).rejects.toThrow(/profile/);
  });

  it('needs the Spotify app saved first', async () => {
    await expect(setup({ spotifyClientId: null, spotifyRedirectUri: redirectUri }).start()).rejects.toThrow(/Client ID/);
    await expect(setup({ spotifyClientId: clientId, spotifyRedirectUri: 'http://192.168.1.2:3001/x' }).start()).rejects.toThrow(/https/);
  });

  it('refreshes an expired token with the install\'s client ID and keeps the old refresh token if none is returned', async () => {
    const { prisma, spotify, service } = setup();
    const source: any = { id: 's1', accessToken: 'old', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() - 1000) };
    await expect(service.accessToken(source)).resolves.toBe('at2');
    expect(spotify.refresh).toHaveBeenCalledWith(clientId, 'rt');
    expect(prisma.recommendationSource.update.mock.calls[0][0].data).toMatchObject({ accessToken: 'at2', refreshToken: 'rt' });
  });

  it('reuses a token that is still fresh', async () => {
    const { spotify, service } = setup();
    const source: any = { id: 's1', accessToken: 'live', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() + 600_000) };
    await expect(service.accessToken(source)).resolves.toBe('live');
    expect(spotify.refresh).not.toHaveBeenCalled();
  });
});
