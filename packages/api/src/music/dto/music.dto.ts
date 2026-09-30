import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertMusicSourceDto {
  @ApiProperty({
    description: 'Username; for Deezer, a profile link or numeric user ID',
    example: 'rob',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  username: string;

  @ApiPropertyOptional({
    description:
      'Last.fm API key, or ListenBrainz user token. Omit to keep the saved value, send "" to clear it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Whether syncs read this source', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class DismissMusicDto {
  @ApiProperty({ example: 'Radiohead' })
  @IsString()
  @MinLength(1)
  artistName: string;

  @ApiPropertyOptional({ description: 'Dismiss only this album; omit to dismiss the artist', example: 'Kid A' })
  @IsOptional()
  @IsString()
  albumTitle?: string;
}

export class AlbumPreviewQueryDto {
  @ApiProperty({ example: 'Radiohead' })
  @IsString()
  @MinLength(1)
  artist: string;

  @ApiProperty({ example: 'In Rainbows' })
  @IsString()
  @MinLength(1)
  album: string;
}
