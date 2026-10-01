import { IsString, IsOptional, IsInt, IsIn, Min, Max, MaxLength, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { DISCOVER_SORTS, DiscoverSort, GAME_DISCOVER_SORTS, GameDiscoverSort } from '../interfaces/external-api.interface';

export class SearchQueryDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'The Matrix',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  query: string;

  @ApiPropertyOptional({
    description: 'Release year filter',
    example: 1999,
    minimum: 1900,
    maximum: 2030,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2030)
  year?: number;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    maximum: 100,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1;
}

export class MovieSearchDto extends SearchQueryDto {}

export class TvSearchDto extends SearchQueryDto {}

export class GameSearchDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'Super Mario',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 20,
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class PopularContentDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    maximum: 100,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Maximum number of results (for games)',
    example: 20,
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class GenreMoviesDto {
  @ApiProperty({
    description: 'Genre ID from TMDB',
    example: 28,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  genreId: number;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    maximum: 100,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1;
}

export class DiscoverDto {
  @ApiPropertyOptional({
    description: 'Genre ID from TMDB; omit to browse every genre',
    example: 28,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  genreId?: number;

  @ApiPropertyOptional({
    description: 'Earliest release year, inclusive',
    example: 1980,
    minimum: 1870,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1870)
  @Max(2100)
  yearFrom?: number;

  @ApiPropertyOptional({
    description: 'Latest release year, inclusive',
    example: 1989,
    minimum: 1870,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1870)
  @Max(2100)
  yearTo?: number;

  @ApiPropertyOptional({
    description: 'Ordering of the listing',
    enum: DISCOVER_SORTS,
    default: 'popular',
  })
  @IsOptional()
  @IsIn(DISCOVER_SORTS)
  sort?: DiscoverSort = 'popular';

  @ApiPropertyOptional({
    description: 'Page number for pagination (TMDB serves at most 500 pages per listing)',
    example: 1,
    minimum: 1,
    maximum: 500,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page?: number = 1;
}

export class GameDiscoverDto extends OmitType(DiscoverDto, ['sort'] as const) {
  @ApiPropertyOptional({
    description: 'Supported platform name; omit to browse every supported platform',
    example: 'SNES',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  platform?: string;

  @ApiPropertyOptional({
    description: 'Ordering of the listing',
    enum: GAME_DISCOVER_SORTS,
    default: 'popular',
  })
  @IsOptional()
  @IsIn(GAME_DISCOVER_SORTS)
  sort?: GameDiscoverSort = 'popular';
}
