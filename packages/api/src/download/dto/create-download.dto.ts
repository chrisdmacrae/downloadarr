import { IsString, IsEnum, IsOptional, IsUrl, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum DownloadType {
  MAGNET = 'magnet',
  TORRENT = 'torrent',
  HTTP = 'http',
  HTTPS = 'https',
}

export class CreateDownloadDto {
  @ApiProperty({
    description: 'Download URL or magnet link',
    example: 'https://example.com/file.zip',
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Type of download',
    enum: DownloadType,
    example: DownloadType.HTTP,
  })
  @IsEnum(DownloadType)
  type: DownloadType;

  @ApiProperty({
    description: 'Destination path for the download',
    example: '/downloads/movies',
    required: false,
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiProperty({
    description: 'Display name for the download',
    example: 'Movie Title (2023)',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Category for organizing downloads',
    example: 'movies',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Media type for metadata',
    enum: ['movie', 'tv', 'game'],
    example: 'movie',
  })
  @IsOptional()
  @IsString()
  mediaType?: 'movie' | 'tv' | 'game';

  @ApiPropertyOptional({
    description: 'Media title for metadata',
    example: 'The Matrix',
  })
  @IsOptional()
  @IsString()
  mediaTitle?: string;

  @ApiPropertyOptional({
    description: 'Media release year for metadata',
    example: 1999,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mediaYear?: number;

  @ApiPropertyOptional({
    description: 'Media poster URL for metadata',
  })
  @IsOptional()
  @IsString()
  mediaPoster?: string;

  @ApiPropertyOptional({
    description: 'Media overview/description for metadata',
  })
  @IsOptional()
  @IsString()
  mediaOverview?: string;
}
