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

  // Animation + Japanese: an anime film.
  const spiritedAway = {
    id: 129,
    title: 'Spirited Away',
    original_title: '千と千尋の神隠し',
    overview: 'A girl wanders into a world of spirits.',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    release_date: '2001-07-20',
    genre_ids: [16, 10751, 14],
    original_language: 'ja',
    popularity: 90,
    vote_average: 8.5,
    vote_count: 5000,
    adult: false,
  };

  // Animation, not Japanese: a Pixar film, which belongs under Movies.
  const toyStory = {
    ...spiritedAway,
    id: 862,
    title: 'Toy Story',
    genre_ids: [16, 35],
    original_language: 'en',
  };

  // Japanese, live action: belongs under Movies.
  const sevenSamurai = {
    ...spiritedAway,
    id: 346,
    title: 'Seven Samurai',
    genre_ids: [18, 28],
    original_language: 'ja',
  };

  const allMovies = [spiritedAway, toyStory, sevenSamurai];

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
        if (endpoint === '/genre/movie/list') {
          return { success: true, data: { genres: [{ id: 16, name: 'Animation' }] } };
        }
        const isMovieEndpoint =
          endpoint.includes('/movie') || endpoint === '/search/movie';
        return { success: true, data: { results: isMovieEndpoint ? allMovies : allShows } };
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

  describe('anime films', () => {
    it('excludes anime films from popular movies', async () => {
      const result = await service.getPopularMovies(1);
      expect(titlesFrom(result)).not.toContain('Spirited Away');
    });

    it('keeps Western animation, which is not anime', async () => {
      const result = await service.getPopularMovies(1);
      expect(titlesFrom(result)).toContain('Toy Story');
    });

    it('keeps Japanese live action, which is not anime', async () => {
      const result = await service.getPopularMovies(1);
      expect(titlesFrom(result)).toContain('Seven Samurai');
    });

    it('excludes anime films from movie search and genre rails', async () => {
      expect(titlesFrom(await service.searchMovies('spirited'))).not.toContain('Spirited Away');
      expect(titlesFrom(await service.getMoviesByGenre(16, 1))).not.toContain('Spirited Away');
    });

    it('keeps only anime films when searching the anime destination', async () => {
      const result = await service.searchAnimeMovies('spirited');
      expect(titlesFrom(result)).toEqual(['Spirited Away']);
    });

    it('asks TMDB for Japanese animated films', async () => {
      await service.getPopularAnimeMovies(1);

      expect(makeRequest).toHaveBeenCalledWith(
        '/discover/movie',
        expect.objectContaining({ with_genres: '16', with_original_language: 'ja' }),
      );
    });

    it('partitions films between Movies and Anime', async () => {
      const movies = titlesFrom(await service.getPopularMovies(1));
      const anime = titlesFrom(await service.searchAnimeMovies('anything'));

      expect(movies.filter(title => anime.includes(title))).toEqual([]);
      expect([...movies, ...anime].sort()).toEqual(allMovies.map(m => m.title).sort());
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
