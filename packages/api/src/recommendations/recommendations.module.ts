import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { GameConfigModule } from '../config/config.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ListenBrainzClient } from '../music/clients/listenbrainz.client';
import { LastFmClient } from '../music/clients/lastfm.client';
import { DeezerClient } from '../music/clients/deezer.client';
import { SpotifyClient } from '../music/clients/spotify.client';
import { SpotifyAuthService } from '../music/services/spotify-auth.service';
import { TasteProfileService } from '../music/services/taste-profile.service';
import { MusicRecommenderService } from '../music/services/music-recommender.service';
import { MusicListsService } from '../music/services/music-lists.service';
import { MusicPreviewService } from '../music/services/music-preview.service';
import { MusicRadioService } from '../music/services/music-radio.service';
import { MusicSearchService } from '../music/services/music-search.service';
import { MusicController } from '../music/music.controller';
import { RecommendationProfilesService } from './services/profiles.service';
import { RecommendationSourcesService } from './services/sources.service';
import { RecommendationAppsService } from './services/app-credentials.service';
import { RecommendationSyncService } from './services/recommendation-sync.service';
import { TraktClient } from './clients/trakt.client';
import { TraktAuthService } from './services/trakt-auth.service';
import { VideoRecommendationsService } from './services/video-recommendations.service';
import { RecommendationsController } from './recommendations.controller';

/**
 * Personal recommendations, per profile: albums from ListenBrainz, Last.fm,
 * Deezer and Spotify listening, and movies and shows from Trakt. Music-specific code lives in src/music; this
 * module owns profiles, accounts and the nightly sync, and wires both together.
 * The sync's @Cron relies on ScheduleModule.forRoot() registered by
 * TorrentsModule.
 */
@Module({
  imports: [HttpModule.register({ timeout: 15000, maxRedirects: 5 }), GameConfigModule, DiscoveryModule],
  providers: [
    ListenBrainzClient,
    LastFmClient,
    DeezerClient,
    SpotifyClient,
    SpotifyAuthService,
    TasteProfileService,
    MusicRecommenderService,
    MusicListsService,
    MusicPreviewService,
    MusicRadioService,
    MusicSearchService,
    RecommendationProfilesService,
    RecommendationSourcesService,
    RecommendationAppsService,
    RecommendationSyncService,
    TraktClient,
    TraktAuthService,
    VideoRecommendationsService,
  ],
  controllers: [RecommendationsController, MusicController],
})
export class RecommendationsModule {}
