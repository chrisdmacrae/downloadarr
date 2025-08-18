import { IsString, IsOptional, IsInt, Min, Max, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
