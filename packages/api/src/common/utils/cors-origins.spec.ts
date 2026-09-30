import { corsOrigins } from './cors-origins';

describe('corsOrigins', () => {
  it('defaults to the local UI', () => {
    expect(corsOrigins({})).toEqual(['http://localhost:3000']);
  });

  it('reads comma-separated FRONTEND_URL', () => {
    expect(corsOrigins({ FRONTEND_URL: 'http://a:3000, https://b.example ' })).toEqual([
      'http://a:3000',
      'https://b.example',
    ]);
  });

  it('adds CORS_ORIGINS to FRONTEND_URL, without duplicates', () => {
    expect(
      corsOrigins({ FRONTEND_URL: 'http://a:3000', CORS_ORIGINS: 'http://nas.local:3000,http://a:3000' }),
    ).toEqual(['http://a:3000', 'http://nas.local:3000']);
  });

  it('keeps the default UI origin when only CORS_ORIGINS is set', () => {
    expect(corsOrigins({ CORS_ORIGINS: 'http://nas.local:3000' })).toEqual([
      'http://localhost:3000',
      'http://nas.local:3000',
    ]);
  });

  it('ignores an empty CORS_ORIGINS', () => {
    expect(corsOrigins({ FRONTEND_URL: 'http://a:3000', CORS_ORIGINS: '' })).toEqual(['http://a:3000']);
  });

  it.each([{ CORS_ORIGINS: '*' }, { CORS_ORIGINS: 'http://x, *' }, { FRONTEND_URL: '*' }])(
    'allows any origin for %p',
    (env) => {
      expect(corsOrigins(env)).toBe(true);
    },
  );
});
