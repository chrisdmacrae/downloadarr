import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseEnumPipe, Post, Put, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MusicSourceProvider } from '../../generated/prisma';
import { MusicSourcesService } from './services/music-sources.service';
import { MusicSyncService } from './services/music-sync.service';
import { MusicPreviewService } from './services/music-preview.service';
import { SpotifyAuthService } from './services/spotify-auth.service';
import {
  AlbumPreviewQueryDto,
  DismissMusicDto,
  SpotifyCallbackQueryDto,
  StartSpotifyAuthDto,
  UpsertMusicSourceDto,
} from './dto/music.dto';

@ApiTags('music')
@Controller('music')
export class MusicController {
  constructor(
    private readonly sources: MusicSourcesService,
    private readonly syncService: MusicSyncService,
    private readonly preview: MusicPreviewService,
    private readonly spotifyAuth: SpotifyAuthService,
  ) {}

  @Get('sources')
  @ApiOperation({ summary: 'List connected listening-history sources' })
  async listSources() {
    const sources = await this.sources.list();
    return { success: true, data: sources.map((s) => this.sources.toView(s)) };
  }

  @Put('sources/:provider')
  @ApiOperation({ summary: 'Connect or update a ListenBrainz, Last.fm or Deezer account' })
  async upsertSource(
    @Param('provider', new ParseEnumPipe(MusicSourceProvider)) provider: MusicSourceProvider,
    @Body() dto: UpsertMusicSourceDto,
  ) {
    const source = await this.sources.upsert(provider, dto);
    // Build lists straight away so the Music page isn't empty until 4am.
    void this.syncService.sync();
    return { success: true, data: this.sources.toView(source) };
  }

  @Delete('sources/:provider')
  @ApiOperation({ summary: 'Disconnect a source' })
  async removeSource(@Param('provider', new ParseEnumPipe(MusicSourceProvider)) provider: MusicSourceProvider) {
    await this.sources.remove(provider);
    return { success: true };
  }

  @Post('spotify/authorize')
  @ApiOperation({ summary: 'Start a Spotify login; returns the Spotify address to open' })
  startSpotifyAuth(@Body() dto: StartSpotifyAuthDto) {
    return { success: true, data: this.spotifyAuth.start(dto) };
  }

  @Get('spotify/callback')
  @Redirect()
  @ApiOperation({ summary: 'Where Spotify sends you after signing in; redirects back to Settings' })
  async spotifyCallback(@Query() query: SpotifyCallbackQueryDto) {
    const { url, connected } = await this.spotifyAuth.handleCallback(query);
    if (connected) void this.syncService.sync();
    return { url, statusCode: 302 };
  }

  @Post('sync')
  @HttpCode(202)
  @ApiOperation({ summary: 'Rebuild recommendations now; poll sync/status for completion' })
  startSync() {
    void this.syncService.sync();
    return { success: true, data: { ...this.syncService.getStatus(), running: true } };
  }

  @Get('sync/status')
  @ApiOperation({ summary: 'Whether a sync is running, and how the last one went' })
  syncStatus() {
    return { success: true, data: this.syncService.getStatus() };
  }

  @Get('discover')
  @ApiOperation({ summary: 'Recommendation lists and your top artists' })
  async discover() {
    const [lists, topArtists] = await Promise.all([this.syncService.lists(), this.syncService.topArtists(12)]);
    return { success: true, data: { lists, topArtists } };
  }

  @Get('preview')
  @ApiOperation({ summary: 'Deezer 30-second previews for an album' })
  async albumPreview(@Query() query: AlbumPreviewQueryDto) {
    const preview = await this.preview.albumPreview(query.artist, query.album);
    if (!preview) throw new NotFoundException('No preview found for this album');
    return { success: true, data: preview };
  }

  @Get('dismissals')
  @ApiOperation({ summary: 'Artists and albums marked not interested' })
  async listDismissals() {
    return { success: true, data: await this.syncService.listDismissals() };
  }

  @Post('dismissals')
  @ApiOperation({ summary: 'Mark an artist or album not interested' })
  async dismiss(@Body() dto: DismissMusicDto) {
    return { success: true, data: await this.syncService.dismiss(dto.artistName, dto.albumTitle) };
  }

  @Delete('dismissals/:id')
  @ApiOperation({ summary: 'Undo a dismissal' })
  async undoDismissal(@Param('id') id: string) {
    await this.syncService.undoDismissal(id);
    return { success: true };
  }
}
