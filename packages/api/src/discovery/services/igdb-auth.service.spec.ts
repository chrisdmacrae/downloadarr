import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { IgdbAuthService } from './igdb-auth.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';
import { of } from 'rxjs';

describe('IgdbAuthService', () => {
  let service: IgdbAuthService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockAppConfigService = {
    getApiKeysConfig: jest.fn(),
  };

  const apiKeys = (overrides: Partial<{ igdbClientId: string | null; igdbClientSecret: string | null }> = {}) => ({
    omdbApiKey: null,
    tmdbApiKey: null,
    igdbClientId: 'test-client-id',
    igdbClientSecret: 'test-client-secret',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IgdbAuthService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: AppConfigurationService,
          useValue: mockAppConfigService,
        },
      ],
    }).compile();

    service = module.get<IgdbAuthService>(IgdbAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccessToken', () => {
    it('should return a valid access token', async () => {
      mockAppConfigService.getApiKeysConfig.mockResolvedValue(apiKeys());

      // Mock successful token response
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          expires_in: 3600,
          token_type: 'bearer',
        },
        status: 200,
      };

      // Mock successful validation response
      const mockValidationResponse = {
        data: [{ id: 1, name: 'Test Game' }],
        status: 200,
      };

      mockHttpService.post
        .mockReturnValueOnce(of(mockTokenResponse)) // Token request
        .mockReturnValueOnce(of(mockValidationResponse)); // Validation request

      const token = await service.getAccessToken();

      expect(token).toBe('test-access-token');
      expect(mockHttpService.post).toHaveBeenCalledTimes(2);

      // Verify token request
      expect(mockHttpService.post).toHaveBeenNthCalledWith(
        1,
        'https://id.twitch.tv/oauth2/token',
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Verify validation request
      expect(mockHttpService.post).toHaveBeenNthCalledWith(
        2,
        'https://api.igdb.com/v4/games',
        'fields id, name; limit 1;',
        expect.objectContaining({
          headers: {
            'Client-ID': 'test-client-id',
            'Authorization': 'Bearer test-access-token',
            'Content-Type': 'text/plain',
          },
        })
      );
    });

    it('should throw error when client ID is missing', async () => {
      mockAppConfigService.getApiKeysConfig.mockResolvedValue(apiKeys({ igdbClientId: null }));

      await expect(service.getAccessToken()).rejects.toThrow(
        'IGDB Client ID is not configured'
      );
    });

    it('should throw error when client secret is missing', async () => {
      mockAppConfigService.getApiKeysConfig.mockResolvedValue(apiKeys({ igdbClientSecret: null }));

      await expect(service.getAccessToken()).rejects.toThrow(
        'IGDB Client Secret is not configured'
      );
    });
  });

  describe('getTokenInfo', () => {
    it('should return token info', () => {
      const tokenInfo = service.getTokenInfo();

      expect(tokenInfo).toHaveProperty('isValid');
      expect(tokenInfo).toHaveProperty('expiresAt');
      expect(tokenInfo).toHaveProperty('hasToken');
      expect(typeof tokenInfo.isValid).toBe('boolean');
      expect(typeof tokenInfo.hasToken).toBe('boolean');
    });
  });
});
