import { isUiRoute } from './serve-ui';

describe('isUiRoute', () => {
  it('answers the UI’s pages', () => {
    expect(isUiRoute('GET', '/')).toBe(true);
    expect(isUiRoute('GET', '/movies/browse')).toBe(true);
    expect(isUiRoute('HEAD', '/settings')).toBe(true);
  });

  it('leaves the API and Socket.IO to the server', () => {
    expect(isUiRoute('GET', '/api')).toBe(false);
    expect(isUiRoute('GET', '/api/v1/movies/popular')).toBe(false);
    expect(isUiRoute('GET', '/api/docs')).toBe(false);
    expect(isUiRoute('GET', '/socket.io/')).toBe(false);
  });

  it('doesn’t take a page whose name only starts with api', () => {
    expect(isUiRoute('GET', '/apiary')).toBe(true);
  });

  it('leaves missing assets and non-GET requests alone', () => {
    expect(isUiRoute('GET', '/assets/index-abc123.js')).toBe(false);
    expect(isUiRoute('POST', '/movies')).toBe(false);
  });
});
