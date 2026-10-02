import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { ContentType } from '../../../generated/prisma';
import { FileOrganizationService } from './file-organization.service';
import { OrganizationContext } from '../interfaces/organization.interface';

/** What a set of downloaded files is: the request's content, or what someone said it is. */
export interface OrganizeTarget {
  contentType: ContentType;
  title: string;
  year?: number;
  /** TV: used for files whose own name does not say which season they are. */
  season?: number;
  episode?: number;
  platform?: string;
  artist?: string;
  requestId?: string;
}

export interface OrganizeOutcome {
  organized: string[];
  /** Still in the downloads folder, and the reason. These need someone to look. */
  failed: Array<{ path: string; error: string }>;
  /** Left behind on purpose: release notes, samples, checksums. */
  skipped: string[];
  /** No longer where the download put them. */
  missing: string[];
}

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
const SUBTITLE_EXTENSIONS = ['.srt', '.sub', '.idx', '.ass', '.ssa', '.vtt'];

/**
 * Moves the files of a finished download into the library. Shared by the
 * download tracker, the retry after a failed move, and organizing a folder
 * from the downloads folder by hand, so all three file things the same way.
 */
@Injectable()
export class DownloadOrganizationService {
  private readonly logger = new Logger(DownloadOrganizationService.name);

  constructor(private readonly fileOrganizationService: FileOrganizationService) {}

  /** `filePaths` are paths as this server sees them. */
  async organizeFiles(filePaths: string[], target: OrganizeTarget): Promise<OrganizeOutcome> {
    const outcome: OrganizeOutcome = { organized: [], failed: [], skipped: [], missing: [] };
    const videos = filePaths.filter(filePath => VIDEO_EXTENSIONS.includes(path.extname(filePath).toLowerCase()));

    for (const filePath of filePaths) {
      if (this.isLeftBehind(filePath)) {
        this.logger.log(`Skipping metadata file: ${filePath}`);
        outcome.skipped.push(filePath);
        continue;
      }

      try {
        const fileName = this.organizedName(filePath, videos);
        // Season and episode are read from the name the file will have, then
        // from the folders it came in
        const seasonEpisode = this.extractSeasonEpisodeFromPath(path.join(path.dirname(filePath), fileName));

        const context: OrganizationContext = {
          contentType: target.contentType,
          title: target.title,
          year: target.year,
          // The file knows which episode it is; the target's season is only
          // for files that do not say
          season: seasonEpisode.season || target.season || undefined,
          episode: seasonEpisode.episode || target.episode || undefined,
          platform: target.platform,
          artist: target.artist,
          subfolder: target.contentType === ContentType.MUSIC ? this.discFolderFromPath(filePath) : undefined,
          quality: this.extractQualityFromPath(filePath),
          format: this.extractFormatFromPath(filePath),
          edition: this.extractEditionFromPath(filePath),
          originalPath: filePath,
          fileName,
        };

        const result = await this.fileOrganizationService.organizeFile(context, target.requestId);

        if (result.success) {
          this.logger.log(`Successfully organized: ${filePath} -> ${result.organizedPath}`);
          outcome.organized.push(filePath);
        } else if (result.error === 'File not found') {
          outcome.missing.push(filePath);
        } else {
          this.logger.warn(`Failed to organize ${filePath}: ${result.error}`);
          outcome.failed.push({ path: filePath, error: result.error || 'Unknown error' });
        }
      } catch (error) {
        this.logger.error(`Error organizing file ${filePath}:`, error);
        outcome.failed.push({ path: filePath, error: error.message });
      }
    }

    return outcome;
  }

  /**
   * The name a file gets in the library. Media servers pair a subtitle with
   * its video by name, but releases often ship them as "Subs/English.srt" or
   * "Subs/<episode>/2_English.srt". Those take the video's name as a prefix,
   * which also stops every episode's "2_English.srt" landing on the same file.
   */
  private organizedName(filePath: string, videos: string[]): string {
    const fileName = path.basename(filePath);
    if (!SUBTITLE_EXTENSIONS.includes(path.extname(fileName).toLowerCase())) {
      return fileName;
    }

    const videoNames = videos.map(video => path.basename(video, path.extname(video)));
    const lowerName = fileName.toLowerCase();
    if (videoNames.some(videoName => lowerName.startsWith(videoName.toLowerCase()))) {
      return fileName;
    }

    const parentFolder = path.basename(path.dirname(filePath)).toLowerCase();
    const named = videoNames.find(videoName => videoName.toLowerCase() === parentFolder)
      ?? (videoNames.length === 1 ? videoNames[0] : undefined);

    return named ? `${named}.${fileName}` : fileName;
  }

  /** Files that are not worth having in the library. */
  isLeftBehind(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const fileNameLower = fileName.toLowerCase();

    return (
      // Aria2 metadata and control files
      fileName.startsWith('[METADATA]') ||
      fileNameLower.endsWith('.aria2') ||
      // Common metadata/info files (be more specific with .txt files)
      fileNameLower.endsWith('.nfo') ||
      fileNameLower.endsWith('.torrent') ||
      fileNameLower.includes('readme') ||
      fileNameLower.includes('info.txt') ||
      fileNameLower.includes('description.txt') ||
      fileNameLower.includes('instructions.txt') ||
      // Sample files
      fileNameLower.includes('sample') ||
      // Checksums and repair data
      fileNameLower.endsWith('.sfv') ||
      fileNameLower.endsWith('.md5') ||
      fileNameLower.endsWith('.sha') ||
      fileNameLower.endsWith('.par2')
    );
  }

  private extractQualityFromPath(filePath: string): string | undefined {
    const fileName = filePath.toLowerCase();

    if (fileName.includes('2160p') || fileName.includes('4k')) return '2160p';
    if (fileName.includes('1080p')) return '1080p';
    if (fileName.includes('720p')) return '720p';
    if (fileName.includes('480p')) return '480p';

    return undefined;
  }

  private extractFormatFromPath(filePath: string): string | undefined {
    const fileName = filePath.toLowerCase();

    if (fileName.includes('x265') || fileName.includes('hevc')) return 'x265';
    if (fileName.includes('x264')) return 'x264';
    if (fileName.includes('av1')) return 'AV1';

    return undefined;
  }

  private extractEditionFromPath(filePath: string): string | undefined {
    const fileName = filePath.toLowerCase();

    if (fileName.includes('bluray') || fileName.includes('brrip')) return 'BluRay';
    if (fileName.includes('webrip')) return 'WEBRip';
    if (fileName.includes('webdl') || fileName.includes('web-dl')) return 'WEB-DL';
    if (fileName.includes('hdtv')) return 'HDTV';
    if (fileName.includes('dvdrip')) return 'DVDRip';

    return undefined;
  }

  /**
   * Multi-disc albums ship as "CD1/01 - Track.flac", "CD2/01 - Track.flac".
   * Keeping the disc folder stops disc 2 overwriting disc 1.
   */
  private discFolderFromPath(filePath: string): string | undefined {
    const parent = filePath.split('/').slice(-2, -1)[0];
    return parent && /^(cd|disc|disk)[\s._-]*\d+$/i.test(parent.trim()) ? parent.trim() : undefined;
  }

  private extractSeasonEpisodeFromPath(filePath: string): { season?: number; episode?: number } {
    const fileName = filePath.toLowerCase();

    // Common TV show patterns
    const patterns = [
      /s(\d+)e(\d+)/i,           // S01E01, s01e01
      /s(\d+)\s*e(\d+)/i,        // S01 E01
      /season\s*(\d+).*episode\s*(\d+)/i, // Season 1 Episode 1
      /(\d+)x(\d+)/,             // 1x01
      /s(\d+)\.e(\d+)/i,         // S01.E01
      /season[\s\._-]*(\d+)[\s\._-]*episode[\s\._-]*(\d+)/i, // Various season/episode formats
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        const season = parseInt(match[1], 10);
        const episode = parseInt(match[2], 10);

        // Validate reasonable ranges
        if (season >= 1 && season <= 50 && episode >= 1 && episode <= 999) {
          return { season, episode };
        }
      }
    }

    // Try to extract just season information from directory structure
    const seasonOnlyPatterns = [
      /season[\s\._-]*(\d+)/i,   // Season 1, season_1, etc.
      /s(\d+)/i,                 // S01, s1, etc.
    ];

    for (const pattern of seasonOnlyPatterns) {
      const match = fileName.match(pattern);
      if (match) {
        const season = parseInt(match[1], 10);

        if (season >= 1 && season <= 50) {
          return { season };
        }
      }
    }

    return {};
  }
}
