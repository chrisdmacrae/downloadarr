import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TorrentRequestsController } from './torrent-requests.controller';
import { RequestedTorrentsService } from '../services/requested-torrents.service';
import { TorrentCheckerService } from '../services/torrent-checker.service';
import { TorrentSearchLogService } from '../services/torrent-search-log.service';
import { TorrentSearchResultsService } from '../services/torrent-search-results.service';
import { DownloadProgressTrackerService } from '../services/download-progress-tracker.service';
import { TvShowMetadataService } from '../services/tv-show-metadata.service';
import { RequestLifecycleOrchestrator } from '../services/request-lifecycle-orchestrator.service';
import { DownloadService } from '../../download/download.service';
import { PrismaService } from '../../database/prisma.service';
import { RequestStatus } from '../../../generated/prisma';

describe('TorrentRequestsController - Re-search Functionality', () => {
  let controller: TorrentRequestsController;
  let requestedTorrentsService: jest.Mocked<RequestedTorrentsService>;
  let torrentCheckerService: jest.Mocked<TorrentCheckerService>;

  beforeEach(async () => {
    const mockRequestedTorrentsService = {
      getRequestById: jest.fn(),
      updateRequestStatus: jest.fn(),
    };

    const mockTorrentCheckerService = {
      searchForSpecificRequest: jest.fn(),
    };

    // The controller takes nine collaborators; this suite only drives two of
    // them, so the rest are stubbed to satisfy the injector.
    const stub = () => ({});

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TorrentRequestsController],
      providers: [
        {
          provide: RequestedTorrentsService,
          useValue: mockRequestedTorrentsService,
        },
        {
          provide: TorrentCheckerService,
          useValue: mockTorrentCheckerService,
        },
        { provide: TorrentSearchLogService, useValue: stub() },
        { provide: TorrentSearchResultsService, useValue: stub() },
        { provide: DownloadProgressTrackerService, useValue: stub() },
        { provide: TvShowMetadataService, useValue: stub() },
        { provide: RequestLifecycleOrchestrator, useValue: stub() },
        { provide: DownloadService, useValue: stub() },
        { provide: PrismaService, useValue: stub() },
      ],
    }).compile();

    controller = module.get<TorrentRequestsController>(TorrentRequestsController);
    requestedTorrentsService = module.get(RequestedTorrentsService);
    torrentCheckerService = module.get(TorrentCheckerService);
  });

  describe('reSearchCancelledRequest', () => {
    const mockRequestId = 'test-request-id';

    it('should successfully re-search a cancelled request', async () => {
      // Arrange
      const mockRequest = {
        id: mockRequestId,
        status: RequestStatus.CANCELLED,
        title: 'Test Movie',
      };

      requestedTorrentsService.getRequestById.mockResolvedValue(mockRequest as any);
      requestedTorrentsService.updateRequestStatus.mockResolvedValue(mockRequest as any);
      torrentCheckerService.searchForSpecificRequest.mockResolvedValue(undefined);

      // Act
      const result = await controller.reSearchCancelledRequest(mockRequestId);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Cancelled request reset and search triggered successfully',
      });

      expect(requestedTorrentsService.getRequestById).toHaveBeenCalledWith(mockRequestId);
      expect(requestedTorrentsService.updateRequestStatus).toHaveBeenCalledWith(
        mockRequestId,
        RequestStatus.PENDING,
        expect.objectContaining({
          searchAttempts: 0,
          nextSearchAt: expect.any(Date),
          lastSearchAt: null,
          foundTorrentTitle: null,
          foundTorrentLink: null,
          foundMagnetUri: null,
          foundTorrentSize: null,
          foundSeeders: null,
          foundIndexer: null,
        })
      );
      expect(torrentCheckerService.searchForSpecificRequest).toHaveBeenCalledWith(mockRequestId);
    });

    it('should throw NOT_FOUND when request does not exist', async () => {
      // Arrange
      requestedTorrentsService.getRequestById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.reSearchCancelledRequest(mockRequestId)).rejects.toThrow(
        new HttpException('Request not found', HttpStatus.NOT_FOUND)
      );

      expect(requestedTorrentsService.updateRequestStatus).not.toHaveBeenCalled();
      expect(torrentCheckerService.searchForSpecificRequest).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when request is not cancelled', async () => {
      // Arrange
      const mockRequest = {
        id: mockRequestId,
        status: RequestStatus.PENDING,
        title: 'Test Movie',
      };

      requestedTorrentsService.getRequestById.mockResolvedValue(mockRequest as any);

      // Act & Assert
      await expect(controller.reSearchCancelledRequest(mockRequestId)).rejects.toThrow(
        new HttpException(
          'Cannot re-search request in PENDING state. Only cancelled requests can be re-searched.',
          HttpStatus.BAD_REQUEST
        )
      );

      expect(requestedTorrentsService.updateRequestStatus).not.toHaveBeenCalled();
      expect(torrentCheckerService.searchForSpecificRequest).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const mockRequest = {
        id: mockRequestId,
        status: RequestStatus.CANCELLED,
        title: 'Test Movie',
      };

      requestedTorrentsService.getRequestById.mockResolvedValue(mockRequest as any);
      requestedTorrentsService.updateRequestStatus.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(controller.reSearchCancelledRequest(mockRequestId)).rejects.toThrow(
        new HttpException('Failed to re-search cancelled request', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });
  });
});
