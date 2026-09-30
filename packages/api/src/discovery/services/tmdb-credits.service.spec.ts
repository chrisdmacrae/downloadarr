import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TmdbService } from './tmdb.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';

/**
 * Cast, recommendations and person pages: what clients show under "Cast & crew",
 * "More like this" and on a person's page.
 */
describe('TmdbService — credits', () => {
  let service: TmdbService;
  let responses: Record<string, unknown>;

  const movie = (id: number, title: string, popularity: number, extra: object = {}) => ({
    id,
    title,
    original_title: title,
    overview: '',
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    release_date: '2020-01-01',
    genre_ids: [18],
    original_language: 'en',
    popularity,
    vote_average: 7,
    vote_count: 10,
    adult: false,
    media_type: 'movie',
    ...extra,
  });

  const show = (id: number, name: string, popularity: number, extra: object = {}) => ({
    id,
    name,
    original_name: name,
    overview: '',
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    first_air_date: '2020-01-01',
    genre_ids: [18],
    origin_country: ['US'],
    original_language: 'en',
    popularity,
    vote_average: 7,
    vote_count: 10,
    media_type: 'tv',
    ...extra,
  });

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
    responses = {
      '/genre/movie/list': { genres: [{ id: 18, name: 'Drama' }] },
      '/genre/tv/list': { genres: [{ id: 18, name: 'Drama' }] },
    };
    jest.spyOn(service as any, 'makeRequest').mockImplementation(async (endpoint: string) => ({
      success: true,
      data: responses[endpoint],
    }));
  });

  describe('movie details', () => {
    beforeEach(() => {
      responses['/movie/603'] = {
        ...movie(603, 'The Matrix', 80),
        genres: [{ id: 18, name: 'Drama' }],
        runtime: 136,
        external_ids: { imdb_id: 'tt0133093' },
        credits: {
          cast: [
            { id: 6384, name: 'Keanu Reeves', character: 'Neo', profile_path: '/keanu.jpg' },
            { id: 2975, name: 'Laurence Fishburne', character: 'Morpheus', profile_path: null },
          ],
          crew: [
            { id: 9339, name: 'Lana Wachowski', job: 'Director', profile_path: '/lana.jpg' },
            { id: 1, name: 'Someone', job: 'Editor', profile_path: null },
          ],
        },
        recommendations: { results: [movie(604, 'The Matrix Reloaded', 60)] },
        videos: {
          results: [
            { key: 'clip', site: 'YouTube', type: 'Clip', official: true, iso_639_1: 'en' },
            { key: 'teaser', site: 'YouTube', type: 'Teaser', official: true, iso_639_1: 'en' },
            { key: 'fan-trailer', site: 'YouTube', type: 'Trailer', official: false, iso_639_1: 'en' },
            { key: 'vimeo-trailer', site: 'Vimeo', type: 'Trailer', official: true, iso_639_1: 'en' },
            { key: 'old-trailer', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'en', published_at: '1999-01-01' },
            { key: 'final-trailer', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'en', published_at: '1999-03-01' },
          ],
        },
      };
    });

    it('picks the newest official YouTube trailer', async () => {
      const { data } = await service.getMovieDetails('603');
      expect(data?.trailer).toBe('final-trailer');
    });

    it('lists the cast with their characters, then the director', async () => {
      const { data } = await service.getMovieDetails('603');
      expect(data?.cast?.map(c => [c.name, c.role, c.department])).toEqual([
        ['Keanu Reeves', 'Neo', 'cast'],
        ['Laurence Fishburne', 'Morpheus', 'cast'],
        ['Lana Wachowski', 'Director', 'crew'],
      ]);
      expect(data?.cast?.[0].photo).toContain('/keanu.jpg');
      expect(data?.cast?.[1].photo).toBeUndefined();
    });

    it('fills the legacy director and actors fields now that credits are fetched', async () => {
      const { data } = await service.getMovieDetails('603');
      expect(data?.director).toBe('Lana Wachowski');
      expect(data?.actors).toBe('Keanu Reeves, Laurence Fishburne');
    });

    it('maps recommendations like any other list result', async () => {
      const { data } = await service.getMovieDetails('603');
      expect(data?.recommendations).toEqual([expect.objectContaining({ id: '604', title: 'The Matrix Reloaded', type: 'movie' })]);
    });
  });

  describe('TV details', () => {
    it('lists the series cast with their first role, then the creators', async () => {
      responses['/tv/1396'] = {
        ...show(1396, 'Breaking Bad', 90),
        genres: [],
        created_by: [{ id: 66633, name: 'Vince Gilligan', profile_path: '/vince.jpg' }],
        networks: [],
        external_ids: { imdb_id: null, tvdb_id: null },
        aggregate_credits: {
          cast: [{ id: 17419, name: 'Bryan Cranston', profile_path: null, roles: [{ character: 'Walter White', episode_count: 62 }] }],
        },
      };
      const { data } = await service.getTvShowDetails('1396');
      expect(data?.cast?.map(c => [c.name, c.role])).toEqual([
        ['Bryan Cranston', 'Walter White'],
        ['Vince Gilligan', 'Creator'],
      ]);
      expect(data?.recommendations).toBeUndefined();
      expect(data?.trailer).toBeUndefined();
    });

    it('falls back to a teaser when there is no trailer', async () => {
      responses['/tv/1'] = {
        ...show(1, 'New Show', 10),
        genres: [],
        created_by: [],
        networks: [],
        external_ids: { imdb_id: null, tvdb_id: null },
        videos: { results: [{ key: 'teaser', site: 'YouTube', type: 'Teaser', official: true, iso_639_1: 'en' }] },
      };
      const { data } = await service.getTvShowDetails('1');
      expect(data?.trailer).toBe('teaser');
    });
  });

  describe('person details', () => {
    beforeEach(() => {
      responses['/person/6384'] = {
        id: 6384,
        name: 'Keanu Reeves',
        biography: 'Actor.',
        birthday: '1964-09-02',
        deathday: null,
        place_of_birth: 'Beirut, Lebanon',
        profile_path: '/keanu.jpg',
        known_for_department: 'Acting',
        combined_credits: {
          cast: [
            movie(603, 'The Matrix', 80),
            movie(245891, 'John Wick', 95),
            show(1, 'Late Night Talk', 99, { genre_ids: [10767] }),
            movie(999, 'No Poster', 100, { poster_path: null }),
          ],
          // Also produced The Matrix: must not appear twice.
          crew: [{ ...movie(603, 'The Matrix', 80), job: 'Producer' }],
        },
      };
    });

    it('returns who they are', async () => {
      const { data } = await service.getPersonDetails('6384');
      expect(data).toEqual(
        expect.objectContaining({ id: '6384', name: 'Keanu Reeves', birthday: '1964-09-02', placeOfBirth: 'Beirut, Lebanon', knownFor: 'Acting' }),
      );
    });

    it('lists their titles most popular first, once each, without talk shows or posterless entries', async () => {
      const { data } = await service.getPersonDetails('6384');
      expect(data?.credits.map(c => c.title)).toEqual(['John Wick', 'The Matrix']);
    });

    it('rejects a non-numeric id', async () => {
      expect(await service.getPersonDetails('abc')).toEqual({ success: false, error: 'Invalid TMDB ID' });
    });
  });
});
