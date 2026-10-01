import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { IgdbService } from './igdb.service';
import { IgdbAuthService } from './igdb-auth.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';

/**
 * Browse listings for games: a platform narrowed to a genre and a span of
 * years, paged. These cover the query sent to IGDB and the paging facts
 * handed back to the UI.
 */
describe('IgdbService — browse listings', () => {
  let service: IgdbService;
  let makeIgdbRequest: jest.SpyInstance;
  let games: any[];
  let count: number | undefined;

  const chronoTrigger = {
    id: 1039,
    name: 'Chrono Trigger',
    summary: 'A boy, a frog and a robot fix time.',
    cover: { id: 1, url: '//images.igdb.com/igdb/image/upload/t_thumb/co1.jpg' },
    first_release_date: 794880000, // 1995-03-11
    genres: [{ id: 12, name: 'Role-playing (RPG)' }],
    platforms: [{ id: 19, name: 'Super Nintendo Entertainment System', abbreviation: 'SNES' }],
    rating: 92.4,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IgdbService,
        { provide: HttpService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: IgdbAuthService, useValue: { getAccessToken: jest.fn() } },
        { provide: AppConfigurationService, useValue: { getApiKeysConfig: jest.fn() } },
      ],
    }).compile();

    service = module.get<IgdbService>(IgdbService);
    games = [chronoTrigger];
    count = 830;

    makeIgdbRequest = jest
      .spyOn(service as any, 'makeIgdbRequest')
      .mockImplementation(async (endpoint: string) => {
        if (endpoint === '/games/count') {
          return count == null ? { success: false, error: 'boom' } : { success: true, data: { count } };
        }
        return { success: true, data: games };
      });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const bodyFor = (endpoint: string): string =>
    makeIgdbRequest.mock.calls.find(([called]) => called === endpoint)?.[1];
  const whereOf = (body: string) => body.match(/where (.*);/)?.[1];

  it('narrows a platform to a genre and a span of release years', async () => {
    await service.discoverGames({ platform: 'SNES', genreId: 12, yearFrom: 1990, yearTo: 1999, page: 3 });

    const body = bodyFor('/games');
    expect(whereOf(body)).toBe(
      'game_type = 0 & platforms = (19) & genres = (12)' +
        ` & first_release_date >= ${Date.UTC(1990, 0, 1) / 1000}` +
        ` & first_release_date < ${Date.UTC(2000, 0, 1) / 1000}` +
        ' & rating_count != null',
    );
    expect(body).toContain('sort rating_count desc;');
    expect(body).toContain('limit 40;');
    expect(body).toContain('offset 80;');
  });

  it('covers every supported platform when given none', async () => {
    await service.discoverGames();

    const where = whereOf(bodyFor('/games'));
    expect(where).toContain('platforms = (6,18,19,4,21,5,41,33,22,24,130,29,32,23,7,8,9,11,12)');
    expect(where).not.toContain('genres');
    expect(where).not.toContain('first_release_date');
  });

  it('refuses a platform it does not know', async () => {
    const result = await service.discoverGames({ platform: 'Virtual Boy' });

    expect(result).toEqual({ success: false, error: 'Platform "Virtual Boy" not supported', statusCode: 400 });
    expect(makeIgdbRequest).not.toHaveBeenCalled();
  });

  it('requires enough ratings for a rating order to mean something', async () => {
    await service.discoverGames({ platform: 'PC', sort: 'top_rated' });

    const body = bodyFor('/games');
    expect(body).toContain('sort rating desc;');
    expect(whereOf(body)).toContain('rating_count >= 10');
  });

  it('lists everything, rated or not, by title', async () => {
    await service.discoverGames({ platform: 'NES', sort: 'title' });

    const body = bodyFor('/games');
    expect(body).toContain('sort name asc;');
    expect(whereOf(body)).toBe('game_type = 0 & platforms = (18)');
  });

  it('leaves undated games out of oldest first', async () => {
    await service.discoverGames({ sort: 'oldest' });

    const body = bodyFor('/games');
    expect(body).toContain('sort first_release_date asc;');
    expect(whereOf(body)).toContain('first_release_date != null');
  });

  it('stops newest first at the end of today so unreleased games do not lead', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-30T12:00:00Z'));

    await service.discoverGames({ sort: 'newest' });

    const body = bodyFor('/games');
    expect(body).toContain('sort first_release_date desc;');
    expect(whereOf(body)).toContain(`first_release_date < ${Date.UTC(2026, 9, 1) / 1000}`);
  });

  it('counts with the same filter it lists with, once', async () => {
    const first = await service.discoverGames({ platform: 'SNES', page: 1 });
    expect(whereOf(bodyFor('/games/count'))).toBe(whereOf(bodyFor('/games')));
    expect(first.data).toMatchObject({ page: 1, totalPages: 21, totalResults: 830 });

    await service.discoverGames({ platform: 'SNES', page: 2 });
    expect(makeIgdbRequest.mock.calls.filter(([endpoint]) => endpoint === '/games/count')).toHaveLength(1);
  });

  it('caps a listing at 500 pages', async () => {
    count = 250000;

    const result = await service.discoverGames({ sort: 'title' });

    expect(result.data).toMatchObject({ totalPages: 500, totalResults: 250000 });
  });

  it('takes a full page to mean another follows when the count fails', async () => {
    count = undefined;
    games = Array.from({ length: 40 }, (_, i) => ({ ...chronoTrigger, id: i + 1 }));

    const full = await service.discoverGames({ page: 2 });
    expect(full.data).toMatchObject({ page: 2, totalPages: 3 });
    expect(full.data?.totalResults).toBeUndefined();

    games = [chronoTrigger];
    const short = await service.discoverGames({ page: 3 });
    expect(short.data).toMatchObject({ page: 3, totalPages: 3 });
  });

  it('maps games onto search results', async () => {
    const result = await service.discoverGames({ platform: 'SNES' });

    expect(result.data?.results).toEqual([
      expect.objectContaining({
        id: '1039',
        title: 'Chrono Trigger',
        year: 1995,
        type: 'game',
        rating: 9.2,
        poster: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
      }),
    ]);
  });

  it('passes an IGDB failure through', async () => {
    makeIgdbRequest.mockResolvedValue({ success: false, error: 'boom', statusCode: 500 });

    const result = await service.discoverGames({ platform: 'SNES' });

    expect(result).toEqual({ success: false, error: 'boom', statusCode: 500 });
  });
});
