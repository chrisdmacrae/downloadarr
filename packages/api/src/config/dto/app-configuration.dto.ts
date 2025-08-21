import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAppConfigurationDto {
  @ApiPropertyOptional({
    description: 'Whether onboarding has been completed',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;

  @ApiPropertyOptional({
    description: 'Jackett API key for torrent search',
    example: 'your_jackett_api_key_here',
  })
  @IsOptional()
  @IsString()
  jackettApiKey?: string;

  @ApiPropertyOptional({
    description: 'Jackett server URL',
    example: 'http://jackett:9117',
  })
  @IsOptional()
  @IsUrl()
  jackettUrl?: string;

  @ApiPropertyOptional({
    description: 'Whether file organization is enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  organizationEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'OMDB API key for movie/TV metadata',
    example: 'your_omdb_api_key_here',
  })
  @IsOptional()
  @IsString()
  omdbApiKey?: string;

  @ApiPropertyOptional({
    description: 'TMDB API key for movie/TV metadata',
    example: 'your_tmdb_api_key_here',
  })
  @IsOptional()
  @IsString()
  tmdbApiKey?: string;

  @ApiPropertyOptional({
    description: 'IGDB Client ID for game metadata',
    example: 'your_igdb_client_id_here',
  })
  @IsOptional()
  @IsString()
  igdbClientId?: string;

  @ApiPropertyOptional({
    description: 'IGDB Client Secret for game metadata',
    example: 'your_igdb_client_secret_here',
  })
  @IsOptional()
  @IsString()
  igdbClientSecret?: string;
}

export class OnboardingStepDto {
  @ApiProperty({
    description: 'Jackett API key',
    example: 'your_jackett_api_key_here',
  })
  @IsString()
  jackettApiKey: string;

  @ApiProperty({
    description: 'Whether to enable organization rules',
    example: true,
  })
  @IsBoolean()
  organizationEnabled: boolean;

  @ApiPropertyOptional({
    description: 'OMDB API key for movie/TV metadata',
    example: 'your_omdb_api_key_here',
  })
  @IsOptional()
  @IsString()
  omdbApiKey?: string;

  @ApiPropertyOptional({
    description: 'TMDB API key for movie/TV metadata',
    example: 'your_tmdb_api_key_here',
  })
  @IsOptional()
  @IsString()
  tmdbApiKey?: string;

  @ApiPropertyOptional({
    description: 'IGDB Client ID for game metadata',
    example: 'your_igdb_client_id_here',
  })
  @IsOptional()
  @IsString()
  igdbClientId?: string;

  @ApiPropertyOptional({
    description: 'IGDB Client Secret for game metadata',
    example: 'your_igdb_client_secret_here',
  })
  @IsOptional()
  @IsString()
  igdbClientSecret?: string;
}
