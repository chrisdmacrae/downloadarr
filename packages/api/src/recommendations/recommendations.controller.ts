import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecommendationSourceProvider, VideoKind } from '../../generated/prisma';
import { RecommendationProfilesService } from './services/profiles.service';
import { RecommendationSourcesService } from './services/sources.service';
import { RecommendationAppsService } from './services/app-credentials.service';
import { RecommendationSyncService } from './services/recommendation-sync.service';
import { SpotifyAuthService } from '../music/services/spotify-auth.service';
import { TraktAuthService } from './services/trakt-auth.service';
import { VideoRecommendationsService } from './services/video-recommendations.service';
import {
  DismissVideoDto,
  ProfileNameDto,
  ProfileScopeQueryDto,
  StartSpotifyAuthDto,
  UpdateRecommendationAppsDto,
  UpsertSourceDto,
} from './dto/recommendations.dto';

const providerPipe = new ParseEnumPipe(RecommendationSourceProvider);

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly profiles: RecommendationProfilesService,
    private readonly sources: RecommendationSourcesService,
    private readonly apps: RecommendationAppsService,
    private readonly syncService: RecommendationSyncService,
    private readonly spotifyAuth: SpotifyAuthService,
    private readonly traktAuth: TraktAuthService,
    private readonly video: VideoRecommendationsService,
  ) {}

  @Get('profiles')
  @ApiOperation({ summary: 'List recommendation profiles' })
  async listProfiles() {
    const profiles = await this.profiles.list();
    return { success: true, data: profiles.map(({ id, name, createdAt }) => ({ id, name, createdAt })) };
  }

  @Post('profiles')
  @ApiOperation({ summary: 'Add a profile' })
  async createProfile(@Body() dto: ProfileNameDto) {
    const { id, name, createdAt } = await this.profiles.create(dto.name);
    return { success: true, data: { id, name, createdAt } };
  }

  @Patch('profiles/:id')
  @ApiOperation({ summary: 'Rename a profile' })
  async renameProfile(@Param('id') id: string, @Body() dto: ProfileNameDto) {
    const { name, createdAt } = await this.profiles.rename(id, dto.name);
    return { success: true, data: { id, name, createdAt } };
  }

  @Delete('profiles/:id')
  @ApiOperation({ summary: 'Delete a profile with its accounts and recommendations' })
  async removeProfile(@Param('id') id: string) {
    await this.profiles.remove(id);
    return { success: true };
  }

  @Get('sources')
  @ApiOperation({ summary: 'List every profile\'s connected accounts' })
  async listSources() {
    const sources = await this.sources.list();
    return { success: true, data: sources.map((s) => this.sources.toView(s)) };
  }

  @Put('profiles/:profileId/sources/:provider')
  @ApiOperation({ summary: 'Connect or update a profile\'s ListenBrainz, Last.fm or Deezer account' })
  async upsertSource(
    @Param('profileId') profileId: string,
    @Param('provider', providerPipe) provider: RecommendationSourceProvider,
    @Body() dto: UpsertSourceDto,
  ) {
    const source = await this.sources.upsert(profileId, provider, dto);
    // Build lists straight away so the pages aren't empty until 4am.
    void this.syncService.sync(profileId);
    return { success: true, data: this.sources.toView(source) };
  }

  @Delete('profiles/:profileId/sources/:provider')
  @ApiOperation({ summary: 'Disconnect a profile\'s account' })
  async removeSource(
    @Param('profileId') profileId: string,
    @Param('provider', providerPipe) provider: RecommendationSourceProvider,
  ) {
    if (provider === RecommendationSourceProvider.TRAKT) {
      // Also revokes the token, so the connection disappears from Trakt's side.
      await this.traktAuth.disconnect(profileId);
    } else {
      await this.sources.remove(profileId, provider);
    }
    return { success: true };
  }

  @Get('apps')
  @ApiOperation({ summary: 'The Spotify and Trakt apps profiles sign in through' })
  async getApps() {
    return { success: true, data: this.apps.toView(await this.apps.get()) };
  }

  @Put('apps')
  @ApiOperation({ summary: 'Save the Spotify and Trakt app credentials' })
  async updateApps(@Body() dto: UpdateRecommendationAppsDto) {
    return { success: true, data: this.apps.toView(await this.apps.update(dto)) };
  }

  @Post('profiles/:profileId/spotify/authorize')
  @ApiOperation({ summary: 'Start a Spotify login for a profile; returns the Spotify address to open' })
  async startSpotifyAuth(@Param('profileId') profileId: string, @Body() dto: StartSpotifyAuthDto) {
    return { success: true, data: await this.spotifyAuth.start({ profileId, returnTo: dto.returnTo }) };
  }

  @Post('profiles/:profileId/trakt/device')
  @ApiOperation({ summary: 'Start a Trakt device login for a profile; returns the code to enter at trakt.tv/activate' })
  async startTraktLogin(@Param('profileId') profileId: string) {
    const login = await this.traktAuth.start(profileId, () => void this.syncService.sync(profileId));
    return { success: true, data: login };
  }

  @Get('profiles/:profileId/trakt/device')
  @ApiOperation({ summary: 'How a profile\'s Trakt device login is going' })
  traktLoginStatus(@Param('profileId') profileId: string) {
    return { success: true, data: this.traktAuth.status(profileId) };
  }

  @Delete('profiles/:profileId/trakt/device')
  @ApiOperation({ summary: 'Abandon a profile\'s Trakt device login' })
  cancelTraktLogin(@Param('profileId') profileId: string) {
    this.traktAuth.cancel(profileId);
    return { success: true };
  }

  @Get('movies')
  @ApiOperation({ summary: 'Recommended and watchlisted movies for a profile, or for everyone' })
  async movies(@Query() query: ProfileScopeQueryDto) {
    return { success: true, data: await this.video.rails(await this.profiles.scope(query.profileId), VideoKind.MOVIE) };
  }

  @Get('tv')
  @ApiOperation({ summary: 'Recommended and watchlisted shows for a profile, or for everyone' })
  async tv(@Query() query: ProfileScopeQueryDto) {
    return { success: true, data: await this.video.rails(await this.profiles.scope(query.profileId), VideoKind.TV) };
  }

  @Get('video-dismissals')
  @ApiOperation({ summary: 'Movies and shows marked not interested' })
  async listVideoDismissals(@Query() query: ProfileScopeQueryDto) {
    const rows = await this.video.listDismissals(await this.profiles.scope(query.profileId));
    return { success: true, data: rows.map(({ profile, ...row }) => ({ ...row, profileName: profile.name })) };
  }

  @Post('video-dismissals')
  @ApiOperation({ summary: 'Mark a movie or show not interested, for one profile or every profile' })
  async dismissVideo(@Body() dto: DismissVideoDto) {
    await this.video.dismiss(await this.profiles.scope(dto.profileId), dto.kind as VideoKind, dto.tmdbId, dto.title);
    return { success: true };
  }

  @Delete('video-dismissals/:id')
  @ApiOperation({ summary: 'Undo a movie or show dismissal' })
  async undoVideoDismissal(@Param('id') id: string) {
    await this.video.undoDismissal(id);
    return { success: true };
  }

  @Post('sync')
  @HttpCode(202)
  @ApiOperation({ summary: 'Rebuild recommendations now; poll sync/status for completion' })
  startSync(@Query() query: ProfileScopeQueryDto) {
    void this.syncService.sync(query.profileId);
    return { success: true, data: { ...this.syncService.getStatus(), running: true } };
  }

  @Get('sync/status')
  @ApiOperation({ summary: 'Whether a sync is running, and how the last one went' })
  syncStatus() {
    return { success: true, data: this.syncService.getStatus() };
  }
}
