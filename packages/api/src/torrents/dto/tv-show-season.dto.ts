import { IsString, IsOptional, IsNumber, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SeasonStatus, EpisodeStatus, TorrentDownloadStatus } from '../../../generated/prisma';

export class CreateTvShowSeasonDto {
  @ApiProperty({
    description: 'Season number',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seasonNumber: number;

  @ApiPropertyOptional({
    description: 'Total episodes in this season (if known)',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalEpisodes?: number;
}

export class UpdateTvShowSeasonDto {
  @ApiPropertyOptional({
    description: 'Update season status',
    enum: SeasonStatus,
  })
  @IsOptional()
  @IsEnum(SeasonStatus)
  status?: SeasonStatus;

  @ApiPropertyOptional({
    description: 'Update total episodes in this season',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalEpisodes?: number;
}

export class CreateTvShowEpisodeDto {
  @ApiProperty({
    description: 'Episode number within the season',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  episodeNumber: number;

  @ApiPropertyOptional({
    description: 'Episode title',
    example: 'Pilot',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Episode air date',
    example: '2023-01-15T20:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  airDate?: string;
}

export class UpdateTvShowEpisodeDto {
  @ApiPropertyOptional({
    description: 'Update episode status',
    enum: EpisodeStatus,
  })
  @IsOptional()
  @IsEnum(EpisodeStatus)
  status?: EpisodeStatus;

  @ApiPropertyOptional({
    description: 'Update episode title',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Update episode air date',
  })
  @IsOptional()
  @IsDateString()
  airDate?: string;
}

export class CreateTorrentDownloadDto {
  @ApiProperty({
    description: 'Torrent title/name',
    example: 'Show.Name.S01E01.1080p.WEB-DL.x264-GROUP',
  })
  @IsString()
  torrentTitle: string;

  @ApiPropertyOptional({
    description: 'Direct torrent file link',
  })
  @IsOptional()
  @IsString()
  torrentLink?: string;

  @ApiPropertyOptional({
    description: 'Magnet URI',
  })
  @IsOptional()
  @IsString()
  magnetUri?: string;

  @ApiPropertyOptional({
    description: 'Torrent file size',
    example: '2.5 GB',
  })
  @IsOptional()
  @IsString()
  torrentSize?: string;

  @ApiPropertyOptional({
    description: 'Number of seeders',
    example: 150,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seeders?: number;

  @ApiPropertyOptional({
    description: 'Indexer/tracker name',
    example: '1337x',
  })
  @IsOptional()
  @IsString()
  indexer?: string;

  @ApiPropertyOptional({
    description: 'TV show season ID (for season pack downloads)',
  })
  @IsOptional()
  @IsString()
  tvShowSeasonId?: string;

  @ApiPropertyOptional({
    description: 'TV show episode ID (for individual episode downloads)',
  })
  @IsOptional()
  @IsString()
  tvShowEpisodeId?: string;
}

export class UpdateTorrentDownloadDto {
  @ApiPropertyOptional({
    description: 'Update download status',
    enum: TorrentDownloadStatus,
  })
  @IsOptional()
  @IsEnum(TorrentDownloadStatus)
  status?: TorrentDownloadStatus;

  @ApiPropertyOptional({
    description: 'Update download progress (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  downloadProgress?: number;

  @ApiPropertyOptional({
    description: 'Update download speed',
    example: '5.2 MB/s',
  })
  @IsOptional()
  @IsString()
  downloadSpeed?: string;

  @ApiPropertyOptional({
    description: 'Update estimated time remaining',
    example: '2h 15m',
  })
  @IsOptional()
  @IsString()
  downloadEta?: string;

  @ApiPropertyOptional({
    description: 'Download job ID from download client',
  })
  @IsOptional()
  @IsString()
  downloadJobId?: string;

  @ApiPropertyOptional({
    description: 'Aria2 GID for tracking',
  })
  @IsOptional()
  @IsString()
  aria2Gid?: string;
}

export class TvShowSeasonQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by season status',
    enum: SeasonStatus,
  })
  @IsOptional()
  @IsEnum(SeasonStatus)
  status?: SeasonStatus;

  @ApiPropertyOptional({
    description: 'Include episode details',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  includeEpisodes?: boolean;

  @ApiPropertyOptional({
    description: 'Include download details',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  includeDownloads?: boolean;
}

export class TvShowEpisodeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by episode status',
    enum: EpisodeStatus,
  })
  @IsOptional()
  @IsEnum(EpisodeStatus)
  status?: EpisodeStatus;

  @ApiPropertyOptional({
    description: 'Include download details',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  includeDownloads?: boolean;
}
