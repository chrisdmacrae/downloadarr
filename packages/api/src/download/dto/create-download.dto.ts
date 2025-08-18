import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
