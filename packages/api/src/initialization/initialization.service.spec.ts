import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InitializationService } from './initialization.service';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    access: jest.fn(),
    constants: {
      F_OK: 0,
      W_OK: 2,
    },
  },
}));

describe('InitializationService', () => {
  let service: InitializationService;
  let configService: ConfigService;
  let mockMkdir: jest.MockedFunction<typeof fs.mkdir>;
  let mockAccess: jest.MockedFunction<typeof fs.access>;

  beforeEach(async () => {
    mockMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
    mockAccess = fs.access as jest.MockedFunction<typeof fs.access>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitializationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              switch (key) {
                case 'DOWNLOAD_PATH':
                  return '/test/downloads';
                case 'LIBRARY_PATH':
                  return '/test/library';
                default:
                  return defaultValue;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<InitializationService>(InitializationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create download directories on module init', async () => {
    mockMkdir.mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(mockMkdir).toHaveBeenCalledWith('/test/downloads/movies', { recursive: true });
    expect(mockMkdir).toHaveBeenCalledWith('/test/downloads/tv-shows', { recursive: true });
    expect(mockMkdir).toHaveBeenCalledWith('/test/downloads/games', { recursive: true });
    expect(mockMkdir).toHaveBeenCalledWith('/test/downloads/other', { recursive: true });
  });

  it('should create library directories on module init', async () => {
    mockMkdir.mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(mockMkdir).toHaveBeenCalledWith('/test/library/movies', { recursive: true });
    expect(mockMkdir).toHaveBeenCalledWith('/test/library/tv-shows', { recursive: true });
    expect(mockMkdir).toHaveBeenCalledWith('/test/library/games', { recursive: true });
  });

  it('should handle existing directories gracefully', async () => {
    const existsError = new Error('Directory exists') as any;
    existsError.code = 'EEXIST';
    mockMkdir.mockRejectedValue(existsError);

    await expect(service.onModuleInit()).resolves.not.toThrow();
  });

  it('should verify directories correctly', async () => {
    mockAccess.mockResolvedValue(undefined);

    const result = await service.verifyDirectories();

    expect(result.downloads).toBe(true);
    expect(result.library).toBe(true);
  });

  it('should handle directory verification failures', async () => {
    mockAccess.mockRejectedValue(new Error('Access denied'));

    const result = await service.verifyDirectories();

    expect(result.downloads).toBe(false);
    expect(result.library).toBe(false);
  });
});
