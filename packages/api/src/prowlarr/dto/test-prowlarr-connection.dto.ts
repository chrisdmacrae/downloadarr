import { IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TestProwlarrConnectionDto {
  @ApiPropertyOptional({
    description: 'Prowlarr URL to test. Falls back to the saved configuration.',
    example: 'http://prowlarr:9696',
  })
  @IsOptional()
  // Container hostnames like http://prowlarr:9696 have no TLD.
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional({
    description: 'Prowlarr API key to test. Falls back to the saved configuration.',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;
}
