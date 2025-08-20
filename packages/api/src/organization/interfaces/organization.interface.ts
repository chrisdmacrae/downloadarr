import { ContentType } from '../../../generated/prisma';

export interface OrganizationContext {
  // Content metadata
  contentType: ContentType;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  platform?: string;

  // Quality information
  quality?: string;
  format?: string;
  edition?: string;

  // File information
  originalPath: string;
  fileName: string;
  fileSize?: number;
}

export interface OrganizationResult {
  success: boolean;
  originalPath: string;
  organizedPath?: string;
  error?: string;
  filesProcessed?: number;
  extractedFiles?: string[];
}

export interface PathGenerationResult {
  folderPath: string;
  fileName: string;
  fullPath: string;
}

export interface FileMetadata {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  platform?: string;
  quality?: string;
  format?: string;
  edition?: string;
}
