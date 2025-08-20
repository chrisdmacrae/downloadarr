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
}
