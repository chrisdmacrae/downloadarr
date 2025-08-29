import { IsString, IsOptional, IsEnum, IsNumber, IsUrl, Min, Max, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ContentType, HttpDownloadRequestStatus } from '../../../generated/prisma';

export class CreateHttpDownloadRequestDto {
  @ApiProperty({
    description: 'HTTP/HTTPS URL to download',
    example: 'https://example.com/movie.mkv',
  })
  @IsString()
  @IsUrl({}, { message: 'Must be a valid HTTP or HTTPS URL' })
  url: string;

  @ApiPropertyOptional({
    description: 'Custom filename for the download',
    example: 'Movie Title (2023).mkv',
  })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({
    description: 'Download destination path',
    example: '/downloads/movies',
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({
    description: 'Request priority (1-10, higher is more important)',
    minimum: 1,
    maximum: 10,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number = 5;

  @ApiPropertyOptional({
    description: 'User ID who created the request',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdateHttpDownloadRequestDto {
  @ApiPropertyOptional({
    description: 'Update request status',
    enum: HttpDownloadRequestStatus,
  })
  @IsOptional()
  @IsEnum(HttpDownloadRequestStatus)
  status?: HttpDownloadRequestStatus;

  @ApiPropertyOptional({
    description: 'Update custom filename',
  })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({
    description: 'Update destination path',
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({
    description: 'Update priority',
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

export class MatchMetadataDto {
  @ApiProperty({
    description: 'Content type of the media',
    enum: ContentType,
    example: ContentType.MOVIE,
  })
  @IsEnum(ContentType)
  contentType: ContentType;

  @ApiProperty({
    description: 'Media title',
    example: 'The Matrix',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Media release year',
    example: 1999,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description: 'IMDB ID (for movies and TV shows)',
    example: 'tt0133093',
  })
  @IsOptional()
  @IsString()
  imdbId?: string;

  @ApiPropertyOptional({
    description: 'TMDB ID (for movies and TV shows)',
    example: 603,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tmdbId?: number;

  @ApiPropertyOptional({
    description: 'IGDB ID (for games)',
    example: 1942,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  igdbId?: number;

  @ApiPropertyOptional({
    description: 'Platform (for games)',
    example: 'PC',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({
    description: 'Genre (for games)',
    example: 'Action',
  })
  @IsOptional()
  @IsString()
  genre?: string;

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
    description: 'Episode number (for TV shows)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  episode?: number;
}

export class HttpDownloadRequestQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by request status',
    enum: HttpDownloadRequestStatus,
  })
  @IsOptional()
  @IsEnum(HttpDownloadRequestStatus)
  status?: HttpDownloadRequestStatus;

  @ApiPropertyOptional({
    description: 'Filter by content type',
    enum: ContentType,
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Search query to filter by title or filename',
    example: 'Matrix',
  })
  @IsOptional()
  @IsString()
  search?: string;

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
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'title', 'priority'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
