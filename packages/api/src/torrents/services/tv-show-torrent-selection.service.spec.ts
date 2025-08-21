import { Test, TestingModule } from '@nestjs/testing';
import { TvShowTorrentSelectionService } from './tv-show-torrent-selection.service';
import { PrismaService } from '../../database/prisma.service';
import { TorrentTitleMatcherService } from './torrent-title-matcher.service';
import { TvShowReleaseValidatorService } from './tv-show-release-validator.service';
import { TvShowMetadataService } from './tv-show-metadata.service';
import { ContentType, EpisodeStatus, SeasonStatus } from '../../../generated/prisma';

describe('TvShowTorrentSelectionService', () => {
  let service: TvShowTorrentSelectionService;
  let prismaService: jest.Mocked<PrismaService>;
  let metadataService: jest.Mocked<TvShowMetadataService>;
  let releaseValidator: jest.Mocked<TvShowReleaseValidatorService>;

  beforeEach(async () => {
    const mockPrismaService = {
      requestedTorrent: {
        findUnique: jest.fn(),
      },
    } as any;

    const mockMetadataService = {
      populateSeasonData: jest.fn(),
    } as any;

    const mockReleaseValidator = {
      isSeasonComplete: jest.fn(),
      isEpisodeReleased: jest.fn(),
    } as any;

    const mockTitleMatcher = {
      analyzeTorrentTitle: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TvShowTorrentSelectionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TvShowMetadataService,
          useValue: mockMetadataService,
        },
        {
          provide: TvShowReleaseValidatorService,
          useValue: mockReleaseValidator,
        },
        {
          provide: TorrentTitleMatcherService,
          useValue: mockTitleMatcher,
        },
      ],
    }).compile();

    service = module.get<TvShowTorrentSelectionService>(TvShowTorrentSelectionService);
    prismaService = module.get(PrismaService) as any;
    metadataService = module.get(TvShowMetadataService) as any;
    releaseValidator = module.get(TvShowReleaseValidatorService) as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeMissingContent', () => {
    it('should populate metadata when no seasons exist and TMDB ID is available', async () => {
      const requestId = 'test-request-id';
      const mockRequest = {
        id: requestId,
        title: 'Alien: Earth',
        tmdbId: 12345,
        contentType: ContentType.TV_SHOW,
        tvShowSeasons: [], // No seasons initially
      };

      const mockRequestWithSeasons = {
        ...mockRequest,
        tvShowSeasons: [
          {
            id: 'season-1',
            seasonNumber: 1,
            totalEpisodes: 10,
            episodes: [
              { id: 'ep-1', episodeNumber: 1, status: EpisodeStatus.PENDING },
              { id: 'ep-2', episodeNumber: 2, status: EpisodeStatus.PENDING },
            ],
          },
        ],
      };

      // First call returns request with no seasons
      (prismaService.requestedTorrent.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockRequest as any)
        // Second call (after metadata population) returns request with seasons
        .mockResolvedValueOnce(mockRequestWithSeasons as any);

      metadataService.populateSeasonData.mockResolvedValueOnce(undefined);
      releaseValidator.isSeasonComplete.mockResolvedValueOnce(true);
      releaseValidator.isEpisodeReleased.mockResolvedValue(true);

      const result = await service.analyzeMissingContent(requestId);

      // Verify metadata service was called
      expect(metadataService.populateSeasonData).toHaveBeenCalledWith(requestId);
      
      // Verify the request was fetched twice (before and after metadata population)
      expect(prismaService.requestedTorrent.findUnique).toHaveBeenCalledTimes(2);
      
      // Verify the result shows missing content
      expect(result.missingSeasons).toEqual([1]);
      expect(result.incompleteSeasons).toEqual([]);
    });

    it('should not populate metadata when seasons already exist', async () => {
      const requestId = 'test-request-id';
      const mockRequest = {
        id: requestId,
        title: 'Alien: Earth',
        tmdbId: 12345,
        contentType: ContentType.TV_SHOW,
        tvShowSeasons: [
          {
            id: 'season-1',
            seasonNumber: 1,
            totalEpisodes: 10,
            episodes: [
              { id: 'ep-1', episodeNumber: 1, status: EpisodeStatus.COMPLETED },
            ],
          },
        ],
      };

      (prismaService.requestedTorrent.findUnique as jest.Mock).mockResolvedValueOnce(mockRequest as any);
      releaseValidator.isSeasonComplete.mockResolvedValueOnce(true);
      releaseValidator.isEpisodeReleased.mockResolvedValue(true);

      const result = await service.analyzeMissingContent(requestId);

      // Verify metadata service was NOT called since seasons already exist
      expect(metadataService.populateSeasonData).not.toHaveBeenCalled();
      
      // Verify the request was fetched only once
      expect(prismaService.requestedTorrent.findUnique).toHaveBeenCalledTimes(1);
      
      // Verify the result shows incomplete season (9 missing episodes)
      expect(result.missingSeasons).toEqual([]);
      expect(result.incompleteSeasons).toHaveLength(1);
      expect(result.incompleteSeasons[0].seasonNumber).toBe(1);
      expect(result.incompleteSeasons[0].missingEpisodes).toHaveLength(9);
    });

    it('should not populate metadata when no TMDB ID is available', async () => {
      const requestId = 'test-request-id';
      const mockRequest = {
        id: requestId,
        title: 'Alien: Earth',
        tmdbId: null, // No TMDB ID
        contentType: ContentType.TV_SHOW,
        tvShowSeasons: [], // No seasons
      };

      (prismaService.requestedTorrent.findUnique as jest.Mock).mockResolvedValueOnce(mockRequest as any);

      const result = await service.analyzeMissingContent(requestId);

      // Verify metadata service was NOT called since no TMDB ID
      expect(metadataService.populateSeasonData).not.toHaveBeenCalled();
      
      // Verify the request was fetched only once
      expect(prismaService.requestedTorrent.findUnique).toHaveBeenCalledTimes(1);
      
      // Verify the result shows no missing content (since no seasons to analyze)
      expect(result.missingSeasons).toEqual([]);
      expect(result.incompleteSeasons).toEqual([]);
    });
  });
});
