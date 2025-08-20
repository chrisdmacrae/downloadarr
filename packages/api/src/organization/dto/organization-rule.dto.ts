import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ContentType } from '../../../generated/prisma';

export class CreateOrganizationRuleDto {
  @ApiProperty({ enum: ContentType, description: 'Content type for this rule' })
  @IsEnum(ContentType)
  contentType: ContentType;

  @ApiProperty({ description: 'Whether this is the default rule for the content type' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty({ description: 'Whether this rule is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Folder naming pattern (e.g., "{title} ({year})")' })
  @IsString()
  folderNamePattern: string;

  @ApiProperty({ description: 'File naming pattern (e.g., "{title} ({year}) - {edition} - {quality} - {format}")' })
  @IsString()
  fileNamePattern: string;

  @ApiProperty({ description: 'Season folder pattern for TV shows (e.g., "Season {seasonNumber}")' })
  @IsString()
  @IsOptional()
  seasonFolderPattern?: string;

  @ApiProperty({ description: 'Base path override for this rule' })
  @IsString()
  @IsOptional()
  basePath?: string;

  @ApiProperty({ description: 'Platform for game rules (optional, for game-specific rules)' })
  @IsString()
  @IsOptional()
  platform?: string;
}

export class UpdateOrganizationRuleDto {
  @ApiProperty({ description: 'Whether this is the default rule for the content type' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty({ description: 'Whether this rule is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Folder naming pattern (e.g., "{title} ({year})")' })
  @IsString()
  @IsOptional()
  folderNamePattern?: string;

  @ApiProperty({ description: 'File naming pattern (e.g., "{title} ({year}) - {edition} - {quality} - {format}")' })
  @IsString()
  @IsOptional()
  fileNamePattern?: string;

  @ApiProperty({ description: 'Season folder pattern for TV shows (e.g., "Season {seasonNumber}")' })
  @IsString()
  @IsOptional()
  seasonFolderPattern?: string;

  @ApiProperty({ description: 'Base path override for this rule' })
  @IsString()
  @IsOptional()
  basePath?: string;

  @ApiProperty({ description: 'Platform for game rules (optional, for game-specific rules)' })
  @IsString()
  @IsOptional()
  platform?: string;
}
