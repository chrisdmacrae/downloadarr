import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { MusicController } from './music.controller';
import { MusicListsService } from './services/music-lists.service';
import { MusicPreviewService } from './services/music-preview.service';
import { MusicRadioService } from './services/music-radio.service';
import { MusicSearchService } from './services/music-search.service';
import { MusicSimilarService } from './services/music-similar.service';
import { SpotifyAuthService } from './services/spotify-auth.service';
import { RecommendationProfilesService } from '../recommendations/services/profiles.service';
import { RecommendationSyncService } from '../recommendations/services/recommendation-sync.service';

describe('MusicController Spotify callback', () => {
  let app: INestApplication;
  const handleCallback = jest.fn(async () => ({ url: 'https://ui.example/settings/recommendations?spotify=connected', connected: true, profileId: 'p1' }));
  const sync = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MusicController],
      providers: [
        { provide: SpotifyAuthService, useValue: { handleCallback } },
        { provide: RecommendationSyncService, useValue: { sync } },
        { provide: MusicListsService, useValue: {} },
        { provide: MusicPreviewService, useValue: {} },
        { provide: MusicRadioService, useValue: {} },
        { provide: MusicSearchService, useValue: {} },
        { provide: MusicSimilarService, useValue: {} },
        { provide: RecommendationProfilesService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // The same pipe main.ts installs.
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('ignores parameters Spotify adds, like ubi, and redirects back', async () => {
    const response = await request(app.getHttpServer())
      .get('/music/spotify/callback')
      .query({ code: 'c1', state: 's1', ubi: 'CAIQ5' });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('https://ui.example/settings/recommendations?spotify=connected');
    expect(handleCallback).toHaveBeenCalledWith({ code: 'c1', state: 's1', error: undefined });
    expect(sync).toHaveBeenCalledWith('p1');
  });
});
