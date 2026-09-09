import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { promises as fs } from 'fs';
import { SystemService } from './system.service';

jest.mock('fs', () => ({
  promises: {
    statfs: jest.fn(),
    stat: jest.fn(),
  },
}));

describe('SystemService', () => {
  let service: SystemService;
  let mockStatfs: jest.Mock;
  let mockStat: jest.Mock;

  // 1000 blocks of 4 KiB: 400 free, 300 of them available to us.
  const statfsResult = { bsize: 4096, blocks: 1000, bfree: 400, bavail: 300 };

  beforeEach(async () => {
    mockStatfs = fs.statfs as unknown as jest.Mock;
    mockStat = fs.stat as unknown as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              switch (key) {
                case 'DOWNLOAD_PATH':
                  return '/app/downloads';
                case 'LIBRARY_PATH':
                  return '/app/library';
                default:
                  return defaultValue;
              }
            }),
          },
        },
        { provide: HttpService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStorageInfo', () => {
    it('reports usage for both configured paths', async () => {
      mockStatfs.mockResolvedValue(statfsResult);
      mockStat.mockResolvedValueOnce({ dev: 1 }).mockResolvedValueOnce({ dev: 2 });

      const { volumes } = await service.getStorageInfo();

      expect(mockStatfs).toHaveBeenCalledWith('/app/downloads');
      expect(mockStatfs).toHaveBeenCalledWith('/app/library');
      expect(volumes).toHaveLength(2);
      expect(volumes[0]).toEqual({
        name: 'downloads',
        path: '/app/downloads',
        total: 4096 * 1000,
        used: 4096 * 600,
        available: 4096 * 300,
        // df-style: used against what is actually writable, not against total.
        usedPercent: (4096 * 600) / (4096 * 900) * 100,
        sharedWith: null,
      });
      // Separate devices, so neither borrows the other's numbers.
      expect(volumes[1].sharedWith).toBeNull();
    });

    it('flags a volume that shares a filesystem with an earlier one', async () => {
      mockStatfs.mockResolvedValue(statfsResult);
      mockStat.mockResolvedValue({ dev: 42 });

      const { volumes } = await service.getStorageInfo();

      expect(volumes[0].sharedWith).toBeNull();
      expect(volumes[1].sharedWith).toBe('downloads');
    });

    it('returns an error entry when a path cannot be read', async () => {
      mockStatfs
        .mockResolvedValueOnce(statfsResult)
        .mockRejectedValueOnce(new Error('ENOENT'));
      mockStat.mockResolvedValue({ dev: 1 });

      const { volumes } = await service.getStorageInfo();

      expect(volumes[0].total).toBe(4096 * 1000);
      expect(volumes[1]).toMatchObject({
        name: 'library',
        total: null,
        available: null,
        usedPercent: null,
        error: 'Path unavailable',
      });
    });
  });
});
