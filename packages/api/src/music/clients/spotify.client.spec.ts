import { createHash } from 'crypto';
import { buildAuthorizeUrl, createPkcePair, SPOTIFY_SCOPES } from './spotify.client';

describe('createPkcePair', () => {
  it('derives the challenge as base64url(sha256(verifier))', () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('is random', () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
  });
});

describe('buildAuthorizeUrl', () => {
  it('asks for a PKCE code with read-only scopes', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'abc',
        redirectUri: 'https://media.example.com/api/v1/music/spotify/callback',
        state: 's1',
        challenge: 'c1',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'abc',
      response_type: 'code',
      redirect_uri: 'https://media.example.com/api/v1/music/spotify/callback',
      state: 's1',
      scope: SPOTIFY_SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: 'c1',
    });
  });
});
