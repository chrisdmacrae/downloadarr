import { TraktAuthService } from './trakt-auth.service';

describe('TraktAuthService', () => {
  const creds = { traktClientId: 'cid', traktClientSecret: 'secret' };
  const tokens = { accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(Date.now() + 7 * 86_400_000) };

  const setup = (apps: Record<string, string | null> = creds) => {
    const prisma: any = {
      recommendationProfile: { findUnique: jest.fn(async ({ where }) => (where.id === 'p1' ? { id: 'p1' } : null)) },
      recommendationSource: {
        upsert: jest.fn(async ({ create }) => create),
        update: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    const trakt: any = {
      deviceCode: jest.fn(async () => ({ deviceCode: 'dc', userCode: 'ABCD1234', verificationUrl: 'https://trakt.tv/activate', expiresIn: 600, interval: 5 })),
      deviceToken: jest.fn(async () => ({ status: 'pending' })),
      me: jest.fn(async () => ({ username: 'sam-slug', name: 'Sam' })),
      refresh: jest.fn(async () => ({ accessToken: 'at2', refreshToken: 'rt2', expiresAt: new Date(Date.now() + 86_400_000) })),
      revoke: jest.fn(),
    };
    const service = new TraktAuthService(prisma, trakt, { get: jest.fn(async () => apps) } as any);
    return { prisma, trakt, service };
  };

  afterEach(() => jest.useRealTimers());

  it('needs the Trakt app saved first', async () => {
    await expect(setup({ traktClientId: 'cid', traktClientSecret: null }).service.start('p1')).rejects.toThrow(/App credentials/);
  });

  it('refuses unknown profiles', async () => {
    await expect(setup().service.start('nope')).rejects.toThrow(/profile/);
  });

  it('returns the code to enter and keeps polling while pending', async () => {
    const { service } = setup();
    const view = await service.start('p1');
    expect(view).toMatchObject({ status: 'pending', userCode: 'ABCD1234', verificationUrl: 'https://trakt.tv/activate' });
    await expect(service.poll('p1')).resolves.toBe(true);
    expect(service.status('p1')?.status).toBe('pending');
    service.cancel('p1');
  });

  it('connects the profile when approved, and calls back', async () => {
    const { service, trakt, prisma } = setup();
    const onConnected = jest.fn();
    await service.start('p1', onConnected);
    trakt.deviceToken.mockResolvedValueOnce({ status: 'connected', tokens });
    await expect(service.poll('p1')).resolves.toBe(false);

    expect(service.status('p1')?.status).toBe('connected');
    expect(onConnected).toHaveBeenCalled();
    const call = prisma.recommendationSource.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ profileId_provider: { profileId: 'p1', provider: 'TRAKT' } });
    expect(call.create).toMatchObject({ username: 'sam-slug', displayName: 'Sam', accessToken: 'at', refreshToken: 'rt' });
  });

  it.each([
    ['denied', 'denied'],
    ['expired', 'expired'],
    ['used', 'error'],
    ['invalid', 'error'],
  ])('stops when Trakt says %s', async (outcome, status) => {
    const { service, trakt } = setup();
    await service.start('p1');
    trakt.deviceToken.mockResolvedValueOnce({ status: outcome });
    await expect(service.poll('p1')).resolves.toBe(false);
    expect(service.status('p1')?.status).toBe(status);
  });

  it('backs off by 5 seconds when asked to slow down', async () => {
    jest.useFakeTimers();
    const { service, trakt } = setup();
    await service.start('p1');
    trakt.deviceToken.mockResolvedValueOnce({ status: 'slow_down' });
    await expect(service.poll('p1')).resolves.toBe(true);
    expect((service as any).logins.get('p1').intervalMs).toBe(10_000);
    service.cancel('p1');
  });

  it('expires locally once the code runs out, without asking Trakt', async () => {
    const { service, trakt } = setup();
    await service.start('p1');
    (service as any).logins.get('p1').expiresAt = new Date(Date.now() - 1);
    await expect(service.poll('p1')).resolves.toBe(false);
    expect(service.status('p1')?.status).toBe('expired');
    expect(trakt.deviceToken).not.toHaveBeenCalled();
  });

  it('refreshes a token near expiry and saves the new pair', async () => {
    const { service, trakt, prisma } = setup();
    const source: any = { id: 's1', accessToken: 'old', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() + 60_000) };
    await expect(service.accessToken(source)).resolves.toBe('at2');
    expect(trakt.refresh).toHaveBeenCalledWith({ clientId: 'cid', clientSecret: 'secret' }, 'rt');
    expect(prisma.recommendationSource.update.mock.calls[0][0].data).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2' });
  });

  it('refreshes only once when two syncs ask at the same time', async () => {
    const { service, trakt } = setup();
    const source: any = { id: 's1', accessToken: 'old', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() - 1) };
    await Promise.all([service.accessToken(source), service.accessToken(source)]);
    expect(trakt.refresh).toHaveBeenCalledTimes(1);
  });

  it('reuses a token that is still fresh', async () => {
    const { service, trakt } = setup();
    const source: any = { id: 's1', accessToken: 'live', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() + 86_400_000) };
    await expect(service.accessToken(source)).resolves.toBe('live');
    expect(trakt.refresh).not.toHaveBeenCalled();
  });

  it('asks to reconnect when the refresh is rejected', async () => {
    const { service, trakt } = setup();
    trakt.refresh.mockRejectedValue(new Error('Trakt: session not found'));
    const source: any = { id: 's1', accessToken: 'old', refreshToken: 'rt', tokenExpiresAt: new Date(Date.now() - 1) };
    await expect(service.accessToken(source)).rejects.toThrow(/Reconnect Trakt/);
  });
});
