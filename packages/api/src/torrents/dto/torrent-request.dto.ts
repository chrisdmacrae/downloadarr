import { IsString, IsOptional, IsArray, IsNumber, IsEnum, Min, Max, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { TorrentQuality, TorrentFormat, RequestStatus } from '../../../generated/prisma';

export class CreateTorrentRequestDto {
  @ApiProperty({
    description: 'Title of the movie or TV show',
    example: 'The Matrix',
  })
  @IsString()
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiPropertyOptional({
    description: 'Release year',
    example: 1999,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 2)
  year?: number;

  @ApiPropertyOptional({
    description: 'IMDB ID for more accurate search',
    example: 'tt0133093',
  })
  @IsOptional()
  @IsString()
  imdbId?: string;

  @ApiPropertyOptional({
    description: 'TMDB ID for more accurate search',
    example: 603,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tmdbId?: number;

  @ApiPropertyOptional({
    description: 'Season number (for TV shows)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  season?: number;

  @ApiPropertyOptional({
    description: 'Episode number (for specific episodes, leave empty for full season)',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  episode?: number;

  @ApiPropertyOptional({
    description: 'Whether this is an ongoing TV show request that should continue searching for new episodes',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOngoing?: boolean;

  @ApiPropertyOptional({
    description: 'Total number of seasons (if known, for completed shows)',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSeasons?: number;

  @ApiPropertyOptional({
    description: 'Total number of episodes (if known, for completed shows)',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalEpisodes?: number;

  @ApiPropertyOptional({
    description: 'IGDB ID for games',
    example: 1020,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  igdbId?: number;

  @ApiPropertyOptional({
    description: 'Game platform (PC, PlayStation, Xbox, etc.)',
    example: 'PC',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({
    description: 'Game genre',
    example: 'Action',
  })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({
    description: 'Preferred video qualities',
    enum: TorrentQuality,
    isArray: true,
    example: [TorrentQuality.HD_1080P, TorrentQuality.UHD_4K],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TorrentQuality, { each: true })
  preferredQualities?: TorrentQuality[];

  @ApiPropertyOptional({
    description: 'Preferred video formats/codecs',
    enum: TorrentFormat,
    isArray: true,
    example: [TorrentFormat.X265, TorrentFormat.HEVC],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TorrentFormat, { each: true })
  preferredFormats?: TorrentFormat[];

  @ApiPropertyOptional({
    description: 'Minimum number of seeders required',
    minimum: 0,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSeeders?: number;

  @ApiPropertyOptional({
    description: 'Maximum file size in GB',
    minimum: 1,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxSizeGB?: number;

  @ApiPropertyOptional({
    description: 'Words to exclude from search results',
    type: [String],
    example: ['cam', 'ts', 'hdcam'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blacklistedWords?: string[];

  @ApiPropertyOptional({
    description: 'Trusted indexer names to prioritize',
    type: [String],
    example: ['1337x', 'RARBG'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trustedIndexers?: string[];

  @ApiPropertyOptional({
    description: 'How often to search for torrents (in minutes)',
    minimum: 5,
    maximum: 1440,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(1440)
  searchIntervalMins?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of search attempts before giving up',
    minimum: 1,
    maximum: 200,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  maxSearchAttempts?: number;

  @ApiPropertyOptional({
    description: 'Request priority (1-10, higher = more priority)',
    minimum: 1,
    maximum: 10,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({
    description: 'User ID (for future multi-user support)',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdateTorrentRequestDto {
  @ApiPropertyOptional({
    description: 'Update request status',
    enum: RequestStatus,
  })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({
    description: 'Update preferred video qualities',
    enum: TorrentQuality,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TorrentQuality, { each: true })
  preferredQualities?: TorrentQuality[];

  @ApiPropertyOptional({
    description: 'Update preferred video formats/codecs',
    enum: TorrentFormat,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TorrentFormat, { each: true })
  preferredFormats?: TorrentFormat[];

  @ApiPropertyOptional({
    description: 'Update minimum number of seeders required',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSeeders?: number;

  @ApiPropertyOptional({
    description: 'Update maximum file size in GB',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxSizeGB?: number;

  @ApiPropertyOptional({
    description: 'Update words to exclude from search results',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blacklistedWords?: string[];

  @ApiPropertyOptional({
    description: 'Update trusted indexer names to prioritize',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trustedIndexers?: string[];

  @ApiPropertyOptional({
    description: 'Update search interval (in minutes)',
    minimum: 5,
    maximum: 1440,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(1440)
  searchIntervalMins?: number;

  @ApiPropertyOptional({
    description: 'Update maximum number of search attempts',
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  maxSearchAttempts?: number;

  @ApiPropertyOptional({
    description: 'Update request priority (1-10, higher = more priority)',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;
}

export class TorrentRequestQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by request status',
    enum: RequestStatus,
  })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Search query to filter by title',
    example: 'Matrix',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
