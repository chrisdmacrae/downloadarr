import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @ApiProperty({ description: 'Base library path' })
  @IsString()
  @IsOptional()
  libraryPath?: string;

  @ApiProperty({ description: 'Movies path override' })
  @IsString()
  @IsOptional()
  moviesPath?: string;

  @ApiProperty({ description: 'TV shows path override' })
  @IsString()
  @IsOptional()
  tvShowsPath?: string;

  @ApiProperty({ description: 'Games path override' })
  @IsString()
  @IsOptional()
  gamesPath?: string;

  @ApiProperty({ description: 'Whether to organize files on download completion' })
  @IsBoolean()
  @IsOptional()
  organizeOnComplete?: boolean;

  @ApiProperty({ description: 'Whether to replace existing files' })
  @IsBoolean()
  @IsOptional()
  replaceExistingFiles?: boolean;

  @ApiProperty({ description: 'Whether to extract archives' })
  @IsBoolean()
  @IsOptional()
  extractArchives?: boolean;

  @ApiProperty({ description: 'Whether to delete archives after extraction' })
  @IsBoolean()
  @IsOptional()
  deleteAfterExtraction?: boolean;

  @ApiProperty({ description: 'Whether to enable reverse indexing' })
  @IsBoolean()
  @IsOptional()
  enableReverseIndexing?: boolean;

  @ApiProperty({ description: 'Cron expression for reverse indexing' })
  @IsString()
  @IsOptional()
  reverseIndexingCron?: string;
}
