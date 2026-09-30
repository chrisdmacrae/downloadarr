import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileNameDto {
  @ApiProperty({ example: 'Sam' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;
}

/** Narrows a read or action to one profile; omit it for every profile. */
export class ProfileScopeQueryDto {
  @ApiPropertyOptional({ description: 'A profile ID; omit for every profile' })
  @IsOptional()
  @IsString()
  profileId?: string;
}

export class UpsertSourceDto {
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

/** Omitted fields keep their value; send "" to clear one. */
export class UpdateRecommendationAppsDto {
  @ApiPropertyOptional({ description: 'Client ID of your Spotify app' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  spotifyClientId?: string;

  @ApiPropertyOptional({
    description: 'HTTPS address of the API\'s Spotify callback, as registered in your Spotify app',
    example: 'https://media.example.com/api/music/spotify/callback',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  spotifyRedirectUri?: string;

  @ApiPropertyOptional({ description: 'Client ID of your Trakt app' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  traktClientId?: string;

  @ApiPropertyOptional({ description: 'Client secret of your Trakt app. Write-only.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  traktClientSecret?: string;
}

export class StartSpotifyAuthDto {
  @ApiProperty({ description: 'Settings page to return to; must be an allowed CORS origin' })
  @IsString()
  returnTo: string;
}

export class DismissVideoDto {
  @ApiProperty({ enum: ['MOVIE', 'TV'] })
  @IsIn(['MOVIE', 'TV'])
  kind: 'MOVIE' | 'TV';

  @ApiProperty({ example: 603 })
  @IsInt()
  @Min(1)
  tmdbId: number;

  @ApiProperty({ example: 'The Matrix' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional({ description: 'Dismiss for this profile only; omit to dismiss for every profile' })
  @IsOptional()
  @IsString()
  profileId?: string;
}
