import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ProwlarrService } from './prowlarr.service';
import { TorrentFilterService } from './torrent-filter.service';
import { GamePlatformsService } from '../../config/game-platforms.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';
import { ProwlarrRelease } from '../interfaces/external-api.interface';

/**
 * Prowlarr returns a bare array of releases whose links are always signed
 * proxies back through Prowlarr itself. These cover the mapping into the
 * `TorrentResult` the rest of the app consumes.
 */
describe('ProwlarrService', () => {
  let service: ProwlarrService;
  let makeRequest: jest.SpyInstance;

  const torrentRelease: ProwlarrRelease = {
    guid: 'https://indexer.example/torrent/1',
    title: 'Some.Movie.2024.1080p.BluRay.x265-GROUP',
    size: 8_589_934_592,
    indexerId: 3,
    indexer: 'Example Indexer',
    publishDate: '2024-05-01T12:00:00Z',
    downloadUrl: 'http://prowlarr:9696/3/download?apikey=abc&link=encoded&file=Some.Movie',
    magnetUrl: 'http://prowlarr:9696/3/download?apikey=abc&link=magnetencoded&file=Some.Movie',
    seeders: 42,
    leechers: 7,
    protocol: 'torrent',
    categories: [
      { id: 2000, name: 'Movies' },
      { id: 2040, name: 'Movies/HD' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProwlarrService,
        TorrentFilterService,
        { provide: HttpService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn((_key, fallback) => fallback) } },
        { provide: GamePlatformsService, useValue: { normalizePlatform: jest.fn(), getIndexerCategoryForPlatform: jest.fn() } },
        {
          provide: AppConfigurationService,
          useValue: {
            getProwlarrConfig: jest.fn().mockResolvedValue({
              apiKey: 'test-key',
              url: 'http://prowlarr:9696',
              flaresolverrUrl: null,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ProwlarrService>(ProwlarrService);
    makeRequest = jest.spyOn(service as any, 'makeRequest');
  });

  const respondWith = (releases: ProwlarrRelease[]) =>
    makeRequest.mockResolvedValue({ success: true, data: releases });

  it('maps a release onto the download link, not the proxied magnet URL', async () => {
    respondWith([torrentRelease]);

    const result = await service.searchTorrents({ query: 'Some Movie' });

    expect(result.success).toBe(true);
    const [torrent] = result.data;
    expect(torrent.title).toBe(torrentRelease.title);
    expect(torrent.link).toBe(torrentRelease.downloadUrl);
    // Prowlarr's magnetUrl is an http proxy link, never a magnet: URI, so it
    // must not be presented as one.
    expect(torrent.magnetUri).toBeUndefined();
    expect(torrent.seeders).toBe(42);
    expect(torrent.leechers).toBe(7);
    expect(torrent.size).toBe('8.00 GB');
    expect(torrent.indexer).toBe('Example Indexer');
    expect(torrent.quality).toBe('1080p');
    expect(torrent.format).toBe('x265');
  });

  it('falls back to the magnet proxy link when there is no download URL', async () => {
    respondWith([{ ...torrentRelease, downloadUrl: undefined }]);

    const result = await service.searchTorrents({ query: 'Some Movie' });

    expect(result.data[0].link).toBe(torrentRelease.magnetUrl);
  });

  it('labels a release with its most specific category', async () => {
    respondWith([torrentRelease]);

    const result = await service.searchTorrents({ query: 'Some Movie' });

    expect(result.data[0].category).toBe('Movies/HD');
  });

  it('drops usenet releases, which Downloadarr cannot grab', async () => {
    respondWith([
      torrentRelease,
      { ...torrentRelease, guid: 'usenet-1', title: 'Some.Movie.2024.1080p.NZB', protocol: 'usenet' },
    ]);

    const result = await service.searchTorrents({ query: 'Some Movie' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe(torrentRelease.title);
  });

  it('sends the Newznab category for the content type', async () => {
    respondWith([]);

    await service.searchMovieTorrents({ query: 'Some Movie', year: 2024 });

    const [endpoint, params] = makeRequest.mock.calls[0];
    expect(endpoint).toBe('/api/v1/search');
    expect(params.query).toBe('Some Movie 2024');
    expect(params.categories).toBe('2000');
    expect(params.type).toBe('search');
  });

  it('omits categories entirely when the caller specifies none', async () => {
    respondWith([]);

    await service.searchTorrents({ query: 'anything' });

    const [, params] = makeRequest.mock.calls[0];
    expect(params).not.toHaveProperty('categories');
  });

  it('reports the error when Prowlarr rejects the search', async () => {
    makeRequest.mockResolvedValue({ success: false, error: 'External API error: Request failed with status code 401' });

    const result = await service.searchTorrents({ query: 'Some Movie' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });
});
