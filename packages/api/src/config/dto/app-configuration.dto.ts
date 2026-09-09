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
    description: 'Prowlarr API key for torrent search',
    example: 'your_prowlarr_api_key_here',
  })
  @IsOptional()
  @IsString()
  prowlarrApiKey?: string;

  @ApiPropertyOptional({
    description: 'Prowlarr server URL',
    example: 'http://prowlarr:9696',
  })
  @IsOptional()
  // Container hostnames like http://prowlarr:9696 have no TLD.
  @IsUrl({ require_tld: false })
  prowlarrUrl?: string;

  @ApiPropertyOptional({
    description: 'FlareSolverr URL, for indexers behind Cloudflare',
    example: 'http://flaresolverr:8191',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  flaresolverrUrl?: string;

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
    description: 'Prowlarr API key',
    example: 'your_prowlarr_api_key_here',
  })
  @IsString()
  prowlarrApiKey: string;

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
