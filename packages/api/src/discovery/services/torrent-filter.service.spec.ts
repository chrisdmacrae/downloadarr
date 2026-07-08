import { Test, TestingModule } from '@nestjs/testing';
import { TorrentFilterService, FilterCriteria } from './torrent-filter.service';
import { TorrentResult } from '../interfaces/external-api.interface';
import { TorrentQuality, TorrentFormat, TorrentLanguage } from '../dto/torrent-search.dto';

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

  describe('detectLanguage', () => {
    it.each([
      ['Movie.2023.FRENCH.1080p.x265-GRP', 'FRENCH'],
      ['Movie.2023.TRUEFRENCH.1080p.x265-GRP', 'FRENCH'],
      ['Movie.2023.VOSTFR.1080p.x265-GRP', 'FRENCH'],
      ['Show.S01.VFF.1080p.x265-GRP', 'FRENCH'],
      ['Movie 2023 VF 1080p', 'FRENCH'],
      ['Movie.2023.MULTi.1080p.x265-GRP', 'MULTI'],
      ['Game.Title.MULTI12.RePack', 'MULTI'],
      ['Movie.2023.Dual.Audio.1080p', 'MULTI'],
      ['Movie.2023.GERMAN.1080p.x265-GRP', 'GERMAN'],
      ['Movie.2023.ITA.1080p.x265-GRP', 'ITALIAN'],
      ['Movie.2023.SPANISH.1080p.x265-GRP', 'SPANISH'],
      ['Movie.2023.LATINO.1080p.x265-GRP', 'SPANISH'],
      ['Movie.2023.JAPANESE.1080p.x265-GRP', 'JAPANESE'],
      ['Movie.2023.KOREAN.1080p.x265-GRP', 'KOREAN'],
      ['Movie.2023.HINDI.1080p.x265-GRP', 'HINDI'],
      ['Movie.2023.DUBLADO.1080p.x265-GRP', 'PORTUGUESE'],
      ['Movie.2023.RUS.1080p.x265-GRP', 'RUSSIAN'],
      ['Movie.2023.DUTCH.1080p.x265-GRP', 'DUTCH'],
      ['Movie.2023.ENGLISH.1080p.x265-GRP', 'ENGLISH'],
      ['Movie.2023.ENG.1080p.x265-GRP', 'ENGLISH'],
    ])('should detect language in "%s" as %s', (title, expected) => {
      expect(service.detectLanguage(title)).toBe(expected);
    });

    it.each([
      // Tokens must not match inside words or common release tags
      ['Movie.2023.Digital.Remaster.1080p'],
      ['Movie.2023.1080p.WEB-DL.x265-GRP'],
      ['Movie.2023.1080p.HDTV.x264-GRP'],
      ['Movie.2023.1080p.x265-GROUP'],
    ])('should not detect a language in untagged title "%s"', (title) => {
      expect(service.detectLanguage(title)).toBeUndefined();
    });
  });

  describe('language filtering', () => {
    const languageTorrents: TorrentResult[] = [
      {
        title: 'Movie.2023.1080p.x265-GROUP', // untagged - counts as English
        size: '2.5GB',
        seeders: 100,
        leechers: 10,
        link: 'magnet:untagged',
        indexer: '1337x',
        publishDate: '2023-01-01T00:00:00Z',
        category: 'Movies/HD',
      },
      {
        title: 'Movie.2023.FRENCH.1080p.x265-GROUP',
        size: '2.5GB',
        seeders: 100,
        leechers: 10,
        link: 'magnet:french',
        indexer: '1337x',
        publishDate: '2023-01-01T00:00:00Z',
        category: 'Movies/HD',
      },
      {
        title: 'Movie.2023.MULTi.1080p.x265-GROUP',
        size: '2.5GB',
        seeders: 100,
        leechers: 10,
        link: 'magnet:multi',
        indexer: '1337x',
        publishDate: '2023-01-01T00:00:00Z',
        category: 'Movies/HD',
      },
    ];

    it('should keep untagged and MULTI but reject foreign tags for English requests', () => {
      const criteria: FilterCriteria = {
        preferredLanguages: [TorrentLanguage.ENGLISH],
      };

      const result = service.filterAndRankTorrents(languageTorrents, criteria);

      expect(result).toHaveLength(2);
      expect(result.some(t => t.link === 'magnet:untagged')).toBe(true);
      expect(result.some(t => t.link === 'magnet:multi')).toBe(true);
      expect(result.some(t => t.link === 'magnet:french')).toBe(false);
    });

    it('should reject untagged (English-by-default) torrents for non-English requests', () => {
      const criteria: FilterCriteria = {
        preferredLanguages: [TorrentLanguage.FRENCH],
      };

      const result = service.filterAndRankTorrents(languageTorrents, criteria);

      expect(result).toHaveLength(2);
      expect(result.some(t => t.link === 'magnet:french')).toBe(true);
      expect(result.some(t => t.link === 'magnet:multi')).toBe(true);
      expect(result.some(t => t.link === 'magnet:untagged')).toBe(false);
    });

    it('should not filter by language when no languages are specified', () => {
      const result = service.filterAndRankTorrents(languageTorrents, {});

      expect(result).toHaveLength(3);
    });

    it('should rank an exact language tag above an equivalent MULTI release', () => {
      const criteria: FilterCriteria = {
        preferredLanguages: [TorrentLanguage.FRENCH],
      };

      const result = service.filterAndRankTorrents(languageTorrents, criteria);

      expect(result[0].link).toBe('magnet:french');
      expect(result[1].link).toBe('magnet:multi');
    });
  });
});
