import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TmdbService } from './tmdb.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';

/**
 * Browse listings: a genre narrowed to a span of years, paged. These cover the
 * filters sent to TMDB and the paging facts handed back to the UI.
 */
describe('TmdbService — browse listings', () => {
  let service: TmdbService;
  let makeRequest: jest.SpyInstance;
  let discoverResponse: { page: number; results: any[]; total_pages: number; total_results: number };

  const dieHard = {
    id: 562,
    title: 'Die Hard',
    original_title: 'Die Hard',
    overview: 'A cop, a tower, a bad Christmas party.',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    release_date: '1988-07-15',
    genre_ids: [28, 53],
    original_language: 'en',
    popularity: 60,
    vote_average: 7.8,
    vote_count: 10000,
    adult: false,
  };

  // Animation + Japanese: an anime film, which belongs under Anime.
  const akira = {
    ...dieHard,
    id: 149,
    title: 'Akira',
    genre_ids: [16, 28],
    original_language: 'ja',
  };

  const cheers = {
    id: 141,
    name: 'Cheers',
    original_name: 'Cheers',
    overview: 'Where everybody knows your name.',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    first_air_date: '1982-09-30',
    genre_ids: [35],
    origin_country: ['US'],
    original_language: 'en',
    popularity: 40,
    vote_average: 7.6,
    vote_count: 500,
  };

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
    discoverResponse = { page: 1, results: [dieHard, akira], total_pages: 42, total_results: 830 };

    makeRequest = jest
      .spyOn(service as any, 'makeRequest')
      .mockImplementation(async (endpoint: string) => {
        if (endpoint.startsWith('/genre/')) {
          return { success: true, data: { genres: [{ id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }] } };
        }
        return { success: true, data: discoverResponse };
      });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const discoverParams = () =>
    makeRequest.mock.calls.find(([endpoint]) => endpoint.startsWith('/discover/'))?.[1];

  it('narrows a movie genre to a span of release years', async () => {
    await service.discoverMovies({ genreId: 28, yearFrom: 1980, yearTo: 1989, page: 3 });

    expect(makeRequest).toHaveBeenCalledWith('/discover/movie', expect.any(Object));
    expect(discoverParams()).toEqual({
      with_genres: '28',
      'primary_release_date.gte': '1980-01-01',
      'primary_release_date.lte': '1989-12-31',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      page: '3',
    });
  });

  it('filters TV shows on first air date', async () => {
    discoverResponse.results = [cheers];

    const result = await service.discoverTvShows({ genreId: 35, yearFrom: 1980, yearTo: 1989 });

    expect(makeRequest).toHaveBeenCalledWith('/discover/tv', expect.any(Object));
    expect(discoverParams()).toMatchObject({
      'first_air_date.gte': '1980-01-01',
      'first_air_date.lte': '1989-12-31',
    });
    expect(result.data?.results.map(item => item.title)).toEqual(['Cheers']);
    expect(result.data?.results[0].type).toBe('tv');
  });

  it('browses every genre and year when given no filters', async () => {
    await service.discoverMovies();

    expect(discoverParams()).toEqual({
      sort_by: 'popularity.desc',
      include_adult: 'false',
      page: '1',
    });
  });

  it('leaves an open-ended range open', async () => {
    await service.discoverMovies({ yearTo: 1949 });

    const params = discoverParams();
    expect(params['primary_release_date.lte']).toBe('1949-12-31');
    expect(params).not.toHaveProperty('primary_release_date.gte');
  });

  it('requires enough votes for a rating order to mean something', async () => {
    await service.discoverMovies({ sort: 'top_rated' });
    expect(discoverParams()).toMatchObject({ sort_by: 'vote_average.desc', 'vote_count.gte': '200' });

    makeRequest.mockClear();
    await service.discoverTvShows({ sort: 'top_rated' });
    expect(discoverParams()).toMatchObject({ sort_by: 'vote_average.desc', 'vote_count.gte': '50' });
  });

  it('orders oldest first by release date', async () => {
    await service.discoverMovies({ sort: 'oldest' });

    expect(discoverParams()).toMatchObject({ sort_by: 'primary_release_date.asc', 'vote_count.gte': '10' });
  });

  describe('newest first', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-30T12:00:00Z'));
    });

    it('stops at today so unreleased titles do not lead', async () => {
      await service.discoverMovies({ sort: 'newest' });

      expect(discoverParams()).toMatchObject({
        sort_by: 'primary_release_date.desc',
        'primary_release_date.lte': '2026-09-30',
      });
    });

    it('stops at today inside the current decade', async () => {
      await service.discoverMovies({ sort: 'newest', yearFrom: 2020, yearTo: 2029 });

      expect(discoverParams()).toMatchObject({
        'primary_release_date.gte': '2020-01-01',
        'primary_release_date.lte': '2026-09-30',
      });
    });

    it('keeps the end of a past decade', async () => {
      await service.discoverMovies({ sort: 'newest', yearFrom: 1980, yearTo: 1989 });

      expect(discoverParams()['primary_release_date.lte']).toBe('1989-12-31');
    });
  });

  it('leaves anime to the anime destination', async () => {
    const result = await service.discoverMovies({ genreId: 28 });

    expect(result.data?.results.map(item => item.title)).toEqual(['Die Hard']);
    expect(result.data?.results[0].genres).toEqual(['Action']);
  });

  it('reports paging, capped at the 500 pages TMDB will serve', async () => {
    const first = await service.discoverMovies({ genreId: 28, page: 1 });
    expect(first.data).toMatchObject({ page: 1, totalPages: 42, totalResults: 830 });

    discoverResponse = { page: 7, results: [dieHard], total_pages: 2500, total_results: 50000 };
    const deep = await service.discoverMovies({ page: 7 });
    expect(deep.data).toMatchObject({ page: 7, totalPages: 500, totalResults: 50000 });
  });

  it('passes a TMDB failure through', async () => {
    makeRequest.mockResolvedValue({ success: false, error: 'External API error: boom', statusCode: 502 });

    const result = await service.discoverMovies({ genreId: 28 });

    expect(result).toEqual({ success: false, error: 'External API error: boom', statusCode: 502 });
  });
});
