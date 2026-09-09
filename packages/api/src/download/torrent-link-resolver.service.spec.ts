import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { TorrentLinkResolverService } from './torrent-link-resolver.service';

/**
 * A Prowlarr link is a signed proxy URL that either serves .torrent bytes or
 * redirects to the real magnet. aria2 cannot follow a redirect out of the http
 * scheme, so the hop has to resolve here.
 */
describe('TorrentLinkResolverService', () => {
  let service: TorrentLinkResolverService;
  let get: jest.Mock;

  const proxyLink = 'http://prowlarr:9696/3/download?apikey=abc&link=encoded&file=Some.Movie';

  beforeEach(async () => {
    get = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TorrentLinkResolverService, { provide: HttpService, useValue: { get } }],
    }).compile();

    service = module.get<TorrentLinkResolverService>(TorrentLinkResolverService);
  });

  it('passes a real magnet URI straight through without a request', async () => {
    const magnet = 'magnet:?xt=urn:btih:0123456789abcdef';

    await expect(service.resolve(magnet)).resolves.toEqual({ kind: 'magnet', magnetUri: magnet });
    expect(get).not.toHaveBeenCalled();
  });

  it('reads the magnet out of a redirect rather than following it', async () => {
    const magnet = 'magnet:?xt=urn:btih:0123456789abcdef&dn=Some.Movie';
    get.mockReturnValue(of({ status: 301, headers: { location: magnet }, data: Buffer.alloc(0) }));

    await expect(service.resolve(proxyLink)).resolves.toEqual({ kind: 'magnet', magnetUri: magnet });
  });

  it('returns the bytes of a .torrent response', async () => {
    const torrent = Buffer.from('d8:announce30:http://tracker.example/announcee');
    get.mockReturnValue(of({ status: 200, headers: {}, data: torrent }));

    const resolved = await service.resolve(proxyLink);

    expect(resolved.kind).toBe('torrent');
    expect(resolved).toMatchObject({ torrent });
  });

  it('handles an indexer that answers with the magnet as the body', async () => {
    const magnet = 'magnet:?xt=urn:btih:0123456789abcdef';
    get.mockReturnValue(of({ status: 200, headers: {}, data: Buffer.from(`${magnet}\n`) }));

    await expect(service.resolve(proxyLink)).resolves.toEqual({ kind: 'magnet', magnetUri: magnet });
  });

  it('follows a plain http redirect with aria2 rather than resolving it here', async () => {
    const elsewhere = 'http://indexer.example/download/1.torrent';
    get.mockReturnValue(of({ status: 302, headers: { location: elsewhere }, data: Buffer.alloc(0) }));

    await expect(service.resolve(proxyLink)).resolves.toEqual({ kind: 'url', url: elsewhere });
  });

  it('hands the URL to aria2 unchanged when the fetch fails', async () => {
    get.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

    await expect(service.resolve(proxyLink)).resolves.toEqual({ kind: 'url', url: proxyLink });
  });

  it('hands the URL to aria2 unchanged when the body is not a torrent', async () => {
    get.mockReturnValue(of({ status: 200, headers: {}, data: Buffer.from('<html>login required</html>') }));

    await expect(service.resolve(proxyLink)).resolves.toEqual({ kind: 'url', url: proxyLink });
  });

  it('leaves a non-http scheme alone', async () => {
    await expect(service.resolve('ftp://example/file.torrent')).resolves.toEqual({
      kind: 'url',
      url: 'ftp://example/file.torrent',
    });
    expect(get).not.toHaveBeenCalled();
  });
});
