import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DismissMusicDto {
  @ApiProperty({ example: 'Radiohead' })
  @IsString()
  @MinLength(1)
  artistName: string;

  @ApiPropertyOptional({ description: 'Dismiss only this album; omit to dismiss the artist', example: 'Kid A' })
  @IsOptional()
  @IsString()
  albumTitle?: string;

  @ApiPropertyOptional({ description: 'Dismiss for this profile only; omit to dismiss for every profile' })
  @IsOptional()
  @IsString()
  profileId?: string;
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

export class MusicSearchQueryDto {
  @ApiProperty({ description: 'Album or artist name', example: 'In Rainbows' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  q: string;
}

export class SimilarAlbumsQueryDto {
  @ApiProperty({ example: 'Radiohead' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  artist: string;

  @ApiProperty({ example: 'In Rainbows' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  album: string;

  @ApiPropertyOptional({ description: 'Whose dismissals to respect; omit for everyone' })
  @IsOptional()
  @IsString()
  profileId?: string;
}

export class ArtistRadioQueryDto {
  @ApiProperty({ example: 'Radiohead' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  artist: string;

  @ApiPropertyOptional({ description: 'Whose ListenBrainz token and dismissals to use; omit for any profile' })
  @IsOptional()
  @IsString()
  profileId?: string;
}
