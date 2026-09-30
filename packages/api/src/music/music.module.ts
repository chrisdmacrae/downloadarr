import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { ListenBrainzClient } from './clients/listenbrainz.client';
import { LastFmClient } from './clients/lastfm.client';
import { DeezerClient } from './clients/deezer.client';
import { MusicSourcesService } from './services/music-sources.service';
import { TasteProfileService } from './services/taste-profile.service';
import { MusicRecommenderService } from './services/music-recommender.service';
import { MusicSyncService } from './services/music-sync.service';
import { MusicPreviewService } from './services/music-preview.service';
import { MusicController } from './music.controller';

/**
 * Music discovery: listening history from ListenBrainz, Last.fm and a public
 * Deezer profile becomes recommendation lists. Deezer's public API also
 * supplies related artists and previews.
 * The nightly sync's @Cron relies on ScheduleModule.forRoot() registered by
 * TorrentsModule.
 */
@Module({
  imports: [HttpModule.register({ timeout: 15000, maxRedirects: 5 })],
  providers: [
    ListenBrainzClient,
    LastFmClient,
    DeezerClient,
    MusicSourcesService,
    TasteProfileService,
    MusicRecommenderService,
    MusicSyncService,
    MusicPreviewService,
  ],
  controllers: [MusicController],
})
export class MusicModule {}
