import { IsString, IsOptional, IsArray, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export enum TorrentQuality {
  SD = 'SD',
  HD_720P = '720p',
  HD_1080P = '1080p',
  UHD_4K = '4K',
  UHD_8K = '8K',
}

export enum TorrentFormat {
  X264 = 'x264',
  X265 = 'x265',
  XVID = 'XviD',
  DIVX = 'DivX',
  AV1 = 'AV1',
  HEVC = 'HEVC',
}

export enum TorrentCategory {
  MOVIES = 'Movies',
  TV = 'TV',
  MOVIES_HD = 'Movies/HD',
  MOVIES_SD = 'Movies/SD',
  MOVIES_UHD = 'Movies/UHD',
  TV_HD = 'TV/HD',
  TV_SD = 'TV/SD',
  TV_UHD = 'TV/UHD',
}

export class TorrentSearchDto {
  @ApiProperty({
    description: 'Search query for torrents',
    example: 'The Matrix 1999',
  })
  @IsString()
  @Transform(({ value }) => value?.trim())
  query: string;

  @ApiPropertyOptional({
    description: 'Torrent category to search in',
    enum: TorrentCategory,
    example: TorrentCategory.MOVIES_HD,
  })
  @IsOptional()
  @IsEnum(TorrentCategory)
  category?: TorrentCategory;

  @ApiPropertyOptional({
    description: 'Specific indexers to search (Jackett tracker names)',
    type: [String],
    example: ['1337x', 'rarbg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  indexers?: string[];

  @ApiPropertyOptional({
    description: 'Minimum number of seeders',
    minimum: 0,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSeeders?: number;

  @ApiPropertyOptional({
    description: 'Maximum file size (e.g., "2GB", "500MB")',
    example: '2GB',
  })
  @IsOptional()
  @IsString()
  maxSize?: string;

  @ApiPropertyOptional({
    description: 'Preferred video qualities',
    enum: TorrentQuality,
    isArray: true,
    example: [TorrentQuality.HD_1080P, TorrentQuality.UHD_4K],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TorrentQuality, { each: true })
  quality?: TorrentQuality[];

  @ApiPropertyOptional({
    description: 'Preferred video formats/codecs',
    enum: TorrentFormat,
    isArray: true,
    example: [TorrentFormat.X265, TorrentFormat.HEVC],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TorrentFormat, { each: true })
  format?: TorrentFormat[];

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
}

export class MovieTorrentSearchDto extends TorrentSearchDto {
  @ApiPropertyOptional({
    description: 'Movie release year',
    example: 1999,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
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
}

export class TvTorrentSearchDto extends TorrentSearchDto {
  @ApiPropertyOptional({
    description: 'TV show season number',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  season?: number;

  @ApiPropertyOptional({
    description: 'TV show episode number',
    minimum: 1,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  episode?: number;

  @ApiPropertyOptional({
    description: 'IMDB ID for more accurate search',
    example: 'tt0944947',
  })
  @IsOptional()
  @IsString()
  imdbId?: string;
}
