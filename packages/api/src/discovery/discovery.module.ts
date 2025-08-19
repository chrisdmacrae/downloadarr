import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

// Services
import { OmdbService } from './services/omdb.service';
import { TmdbService } from './services/tmdb.service';
import { IgdbService } from './services/igdb.service';
import { JackettService } from './services/jackett.service';
import { TorrentFilterService } from './services/torrent-filter.service';
import { TorrentPreferencesService } from './services/torrent-preferences.service';

// Controllers
import { MoviesController } from './controllers/movies.controller';
import { TvShowsController } from './controllers/tv-shows.controller';
import { GamesController } from './controllers/games.controller';
import { TorrentsController } from './controllers/torrents.controller';
import { TorrentPreferencesController } from './controllers/torrent-preferences.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [
    OmdbService,
    TmdbService,
    IgdbService,
    JackettService,
    TorrentFilterService,
    TorrentPreferencesService,
  ],
  controllers: [
    MoviesController,
    TvShowsController,
    GamesController,
    TorrentsController,
    TorrentPreferencesController,
  ],
  exports: [
    OmdbService,
    TmdbService,
    IgdbService,
    JackettService,
    TorrentFilterService,
    TorrentPreferencesService,
  ],
})
export class DiscoveryModule {}
