import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

// Services
import { OmdbService } from './services/omdb.service';
import { TmdbService } from './services/tmdb.service';
import { IgdbService } from './services/igdb.service';

// Controllers
import { MoviesController } from './controllers/movies.controller';
import { TvShowsController } from './controllers/tv-shows.controller';
import { GamesController } from './controllers/games.controller';

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
  ],
  controllers: [
    MoviesController,
    TvShowsController,
    GamesController,
  ],
  exports: [
    OmdbService,
    TmdbService,
    IgdbService,
  ],
})
export class DiscoveryModule {}
