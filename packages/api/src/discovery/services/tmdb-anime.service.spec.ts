import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TmdbService } from './tmdb.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';

/**
 * TMDB has no anime genre, so anime is "animation produced in Japan". These
 * cover the split between the TV and anime destinations: every title must
 * appear in exactly one of them.
 */
describe('TmdbService — anime classification', () => {
  let service: TmdbService;
  let makeRequest: jest.SpyInstance;

  // Animation + Japanese: anime.
  const cowboyBebop = {
    id: 30991,
    name: 'Cowboy Bebop',
    original_name: 'カウボーイビバップ',
    overview: 'Bounty hunters in space.',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    first_air_date: '1998-04-03',
    genre_ids: [16, 10759],
    origin_country: ['JP'],
    original_language: 'ja',
    popularity: 50,
    vote_average: 8.6,
    vote_count: 1000,
  };

  // Animation, but not Japanese: a Western cartoon, which belongs under TV.
  const rickAndMorty = {
    ...cowboyBebop,
    id: 60625,
    name: 'Rick and Morty',
    genre_ids: [16, 35],
    origin_country: ['US'],
    original_language: 'en',
  };

  // Japanese, but live action: a J-drama, which belongs under TV.
  const midnightDiner = {
    ...cowboyBebop,
    id: 54964,
    name: 'Midnight Diner',
    genre_ids: [18],
    origin_country: ['JP'],
    original_language: 'ja',
  };

  // Neither.
  const breakingBad = {
    ...cowboyBebop,
    id: 1396,
    name: 'Breaking Bad',
    genre_ids: [18, 80],
    origin_country: ['US'],
    original_language: 'en',
  };

  const allShows = [cowboyBebop, rickAndMorty, midnightDiner, breakingBad];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmdbService,
        { provide: HttpService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: AppConfigurationService, useValue: { getApiKeysConfig: jest.fn() } },
      ],
    }).compile();

    service = module.get<TmdbService>(TmdbService);

    makeRequest = jest
      .spyOn(service as any, 'makeRequest')
      .mockImplementation(async (endpoint: string) => {
        if (endpoint === '/genre/tv/list') {
          return { success: true, data: { genres: [{ id: 16, name: 'Animation' }] } };
        }
        return { success: true, data: { results: allShows } };
      });
  });

  const titlesFrom = (result: { data?: Array<{ title: string }> }) =>
    (result.data || []).map(item => item.title);

  describe('TV destination', () => {
    it('excludes anime from popular TV shows', async () => {
      const result = await service.getPopularTvShows(1);
      const titles = titlesFrom(result);

      expect(titles).not.toContain('Cowboy Bebop');
      expect(titles).toEqual(
        expect.arrayContaining(['Rick and Morty', 'Midnight Diner', 'Breaking Bad']),
      );
    });

    it('keeps Western animation, which is not anime', async () => {
      const result = await service.getPopularTvShows(1);
      expect(titlesFrom(result)).toContain('Rick and Morty');
    });

    it('keeps Japanese live action, which is not anime', async () => {
      const result = await service.getPopularTvShows(1);
      expect(titlesFrom(result)).toContain('Midnight Diner');
    });

    it('excludes anime from TV search', async () => {
      const result = await service.searchTvShows('bebop');
      expect(titlesFrom(result)).not.toContain('Cowboy Bebop');
    });

    it('excludes anime from TV genre rails', async () => {
      const result = await service.getTvShowsByGenre(10759, 1);
      expect(titlesFrom(result)).not.toContain('Cowboy Bebop');
    });
  });

  describe('anime destination', () => {
    it('keeps only anime when searching', async () => {
      const result = await service.searchAnime('bebop');
      expect(titlesFrom(result)).toEqual(['Cowboy Bebop']);
    });

    it('asks TMDB for Japanese animation', async () => {
      await service.getPopularAnime(1);

      expect(makeRequest).toHaveBeenCalledWith(
        '/discover/tv',
        expect.objectContaining({ with_genres: '16', with_original_language: 'ja' }),
      );
    });

    it('combines animation with the requested genre', async () => {
      await service.getAnimeByGenre(10759, 1);

      expect(makeRequest).toHaveBeenCalledWith(
        '/discover/tv',
        expect.objectContaining({ with_genres: '16,10759', with_original_language: 'ja' }),
      );
    });
  });

  it('puts every title in exactly one destination', async () => {
    // The two lists must partition the catalogue: no title in both, none lost.
    const tv = titlesFrom(await service.getPopularTvShows(1));
    const anime = titlesFrom(await service.searchAnime('anything'));

    expect(tv.filter(title => anime.includes(title))).toEqual([]);
    expect([...tv, ...anime].sort()).toEqual(allShows.map(s => s.name).sort());
  });
});
