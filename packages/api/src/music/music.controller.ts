import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MusicListsService } from './services/music-lists.service';
import { MusicPreviewService } from './services/music-preview.service';
import { MusicRadioService } from './services/music-radio.service';
import { SpotifyAuthService } from './services/spotify-auth.service';
import { RecommendationProfilesService } from '../recommendations/services/profiles.service';
import { RecommendationSyncService } from '../recommendations/services/recommendation-sync.service';
import { ProfileScopeQueryDto } from '../recommendations/dto/recommendations.dto';
import { AlbumPreviewQueryDto, ArtistRadioQueryDto, DismissMusicDto } from './dto/music.dto';

/**
 * The Music page. Every read takes an optional `profileId`; without one it
 * covers every profile, merged. Accounts, profiles and syncing live under
 * /recommendations.
 */
@ApiTags('music')
@Controller('music')
export class MusicController {
  constructor(
    private readonly lists: MusicListsService,
    private readonly profiles: RecommendationProfilesService,
    private readonly syncService: RecommendationSyncService,
    private readonly preview: MusicPreviewService,
    private readonly radio: MusicRadioService,
    private readonly spotifyAuth: SpotifyAuthService,
  ) {}

  // Stays here, not under /recommendations: it's the address registered in
  // people's Spotify apps.
  @Get('spotify/callback')
  @Redirect()
  @ApiOperation({ summary: 'Where Spotify sends you after signing in; redirects back to Settings' })
  // Named parameters rather than a DTO: Spotify adds its own (like `ubi`), and
  // the global pipe would reject a DTO with properties it doesn't declare.
  async spotifyCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const { url, connected, profileId } = await this.spotifyAuth.handleCallback({ code, state, error });
    if (connected) void this.syncService.sync(profileId);
    return { url, statusCode: 302 };
  }

  @Get('discover')
  @ApiOperation({ summary: 'Album lists and top artists for a profile, or for everyone' })
  async discover(@Query() query: ProfileScopeQueryDto) {
    const profiles = await this.profiles.scope(query.profileId);
    const lists = await this.lists.lists(profiles);
    return { success: true, data: { lists, topArtists: this.lists.topArtists(profiles, 12) } };
  }

  @Get('preview')
  @ApiOperation({ summary: 'Deezer 30-second previews for an album' })
  async albumPreview(@Query() query: AlbumPreviewQueryDto) {
    const preview = await this.preview.albumPreview(query.artist, query.album);
    if (!preview) throw new NotFoundException('No preview found for this album');
    return { success: true, data: preview };
  }

  @Get('radio')
  @ApiOperation({ summary: 'Artist radio: Deezer\'s artist mix, plus LB Radio when a ListenBrainz token is set' })
  async artistRadio(@Query() query: ArtistRadioQueryDto) {
    const radio = await this.radio.artistRadio(query.artist, await this.profiles.scope(query.profileId));
    if (!radio) throw new NotFoundException(`No radio found for ${query.artist}`);
    return { success: true, data: radio };
  }

  @Get('dismissals')
  @ApiOperation({ summary: 'Artists and albums marked not interested' })
  async listDismissals(@Query() query: ProfileScopeQueryDto) {
    const rows = await this.lists.listDismissals(await this.profiles.scope(query.profileId));
    return {
      success: true,
      data: rows.map(({ profile, ...row }) => ({ ...row, profileName: profile.name })),
    };
  }

  @Post('dismissals')
  @ApiOperation({ summary: 'Mark an artist or album not interested, for one profile or every profile' })
  async dismiss(@Body() dto: DismissMusicDto) {
    const profiles = await this.profiles.scope(dto.profileId);
    return { success: true, data: await this.lists.dismiss(profiles, dto.artistName, dto.albumTitle) };
  }

  @Delete('dismissals/:id')
  @ApiOperation({ summary: 'Undo a dismissal' })
  async undoDismissal(@Param('id') id: string) {
    await this.lists.undoDismissal(id);
    return { success: true };
  }
}
