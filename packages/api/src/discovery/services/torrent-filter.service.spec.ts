import { Test, TestingModule } from '@nestjs/testing';
import { TorrentFilterService, FilterCriteria } from './torrent-filter.service';
import { TorrentResult } from '../interfaces/external-api.interface';
import { TorrentQuality, TorrentFormat } from '../dto/torrent-search.dto';

describe('TorrentFilterService', () => {
  let service: TorrentFilterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TorrentFilterService],
    }).compile();

    service = module.get<TorrentFilterService>(TorrentFilterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('filterAndRankTorrents', () => {
    const mockTorrents: TorrentResult[] = [
      {
        title: 'Movie.2023.1080p.x265.HEVC-GROUP',
        size: '2.5GB',
        seeders: 100,
        leechers: 10,
        link: 'magnet:test1',
        indexer: '1337x',
        publishDate: '2023-01-01T00:00:00Z',
        category: 'Movies/HD',
      },
      {
        title: 'Movie.2023.720p.x264-GROUP',
        size: '1.2GB',
        seeders: 50,
        leechers: 5,
        link: 'magnet:test2',
        indexer: 'RARBG',
        publishDate: '2023-01-01T00:00:00Z',
        category: 'Movies/HD',
      },
      {
        title: 'Movie.2023.480p.XviD-GROUP',
        size: '700MB',
        seeders: 20,
        leechers: 2,
        link: 'magnet:test3',
        indexer: 'YTS',
        publishDate: '2023-01-01T00:00:00Z',
        category: 'Movies/SD',
      },
      {
        title: 'Movie.2023.4K.x265.HDR-GROUP',
        size: '15GB',
        seeders: 200,
        leechers: 20,
        link: 'magnet:test4',
        indexer: '1337x',
        publishDate: '2023-01-01T00:00:00Z',
        category: 'Movies/UHD',
      },
    ];

    it('should filter out torrents that do not meet preferred quality criteria', () => {
      const criteria: FilterCriteria = {
        preferredQualities: [TorrentQuality.HD_1080P, TorrentQuality.UHD_4K],
      };

      const result = service.filterAndRankTorrents(mockTorrents, criteria);

      // Should only include 1080p and 4K torrents, excluding 720p and 480p
      expect(result).toHaveLength(2);
      expect(result.some(t => t.title.includes('1080p'))).toBe(true);
      expect(result.some(t => t.title.includes('4K'))).toBe(true);
      expect(result.some(t => t.title.includes('720p'))).toBe(false);
      expect(result.some(t => t.title.includes('480p'))).toBe(false);
    });

    it('should filter out torrents that do not meet preferred format criteria', () => {
      const criteria: FilterCriteria = {
        preferredFormats: [TorrentFormat.X265, TorrentFormat.HEVC],
      };

      const result = service.filterAndRankTorrents(mockTorrents, criteria);

      // Should only include x265/HEVC torrents, excluding x264 and XviD
      expect(result).toHaveLength(2);
      expect(result.some(t => t.title.includes('x265'))).toBe(true);
      expect(result.some(t => t.title.includes('4K'))).toBe(true); // 4K torrent has x265
      expect(result.some(t => t.title.includes('x264'))).toBe(false);
      expect(result.some(t => t.title.includes('XviD'))).toBe(false);
    });

    it('should filter by both quality and format criteria', () => {
      const criteria: FilterCriteria = {
        preferredQualities: [TorrentQuality.HD_1080P],
        preferredFormats: [TorrentFormat.X265],
      };

      const result = service.filterAndRankTorrents(mockTorrents, criteria);

      // Should only include the 1080p x265 torrent
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('1080p');
      expect(result[0].title).toContain('x265');
    });

    it('should apply other filters alongside quality/format filters', () => {
      const criteria: FilterCriteria = {
        preferredQualities: [TorrentQuality.HD_1080P, TorrentQuality.UHD_4K],
        minSeeders: 150,
      };

      const result = service.filterAndRankTorrents(mockTorrents, criteria);

      // Should only include 4K torrent (has 200 seeders), 1080p has only 100 seeders
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('4K');
    });

    it('should return empty array when no torrents meet criteria', () => {
      const criteria: FilterCriteria = {
        preferredQualities: [TorrentQuality.UHD_8K], // No 8K torrents in mock data
      };

      const result = service.filterAndRankTorrents(mockTorrents, criteria);

      expect(result).toHaveLength(0);
    });

    it('should rank torrents correctly when multiple match criteria', () => {
      const criteria: FilterCriteria = {
        preferredQualities: [TorrentQuality.HD_1080P, TorrentQuality.UHD_4K],
        preferredFormats: [TorrentFormat.X265],
      };

      const result = service.filterAndRankTorrents(mockTorrents, criteria);

      // Should include both 1080p x265 and 4K x265 torrents
      expect(result).toHaveLength(2);
      
      // 4K should be ranked higher due to higher quality score and more seeders
      expect(result[0].title).toContain('4K');
      expect(result[1].title).toContain('1080p');
    });
  });
});
