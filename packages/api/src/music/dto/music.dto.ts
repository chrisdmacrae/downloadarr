import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertMusicSourceDto {
  @ApiProperty({
    description: 'Username; for Deezer, a profile link or numeric user ID',
    example: 'rob',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  username: string;

  @ApiPropertyOptional({
    description:
      'Last.fm API key, or ListenBrainz user token. Omit to keep the saved value, send "" to clear it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Whether syncs read this source', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class StartSpotifyAuthDto {
  @ApiProperty({ description: 'Client ID of your Spotify app', example: '0123456789abcdef0123456789abcdef' })
  @IsString()
  clientId: string;

  @ApiProperty({
    description: 'HTTPS address of this API\'s callback, as registered in the Spotify app',
    example: 'https://media.example.com/api/music/spotify/callback',
  })
  @IsString()
  redirectUri: string;

  @ApiProperty({ description: 'Settings page to return to; must be an allowed CORS origin' })
  @IsString()
  returnTo: string;
}

export class SpotifyCallbackQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() error?: string;
}

export class DismissMusicDto {
  @ApiProperty({ example: 'Radiohead' })
  @IsString()
  @MinLength(1)
  artistName: string;

  @ApiPropertyOptional({ description: 'Dismiss only this album; omit to dismiss the artist', example: 'Kid A' })
  @IsOptional()
  @IsString()
  albumTitle?: string;
}

export class AlbumPreviewQueryDto {
  @ApiProperty({ example: 'Radiohead' })
  @IsString()
  @MinLength(1)
  artist: string;

  @ApiProperty({ example: 'In Rainbows' })
  @IsString()
  @MinLength(1)
  album: string;
}

export class ArtistRadioQueryDto {
  @ApiProperty({ example: 'Radiohead' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  artist: string;
}
