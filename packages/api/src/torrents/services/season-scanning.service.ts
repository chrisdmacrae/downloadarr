import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRulesService } from '../../organization/services/organization-rules.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';
import { TvShowMetadataService } from './tv-show-metadata.service';
import { ContentType, EpisodeStatus } from '../../../generated/prisma';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  normalizeShowTitle,
  parseEpisodesFromFileName,
  parseSeasonFromFolderName,
  parseYearFromFolderName,
} from '../../common/utils/episode-files';

const MEDIA_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  air_date: string;
  season_number: number;
}

@Injectable()
export class SeasonScanningService {
  private readonly logger = new Logger(SeasonScanningService.name);
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';
  private readonly scansInFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationRulesService: OrganizationRulesService,
    private readonly appConfigService: AppConfigurationService,
    @Inject(forwardRef(() => TvShowMetadataService))
    private readonly tvShowMetadataService: TvShowMetadataService,
  ) {}

  /**
   * Scan all TV show seasons and update episode progress based on organized files
   */
  async scanAllSeasons(): Promise<{
    seasonsScanned: number;
    episodesUpdated: number;
    episodesMarkedMissing: number;
    errors: number;
  }> {
    const results = { seasonsScanned: 0, episodesUpdated: 0, episodesMarkedMissing: 0, errors: 0 };

    try {
      // Get all TV show requests that have seasons
      const tvShowRequests = await this.prisma.requestedTorrent.findMany({
        where: {
          contentType: ContentType.TV_SHOW,
        },
        include: {
          tvShowSeasons: {
            include: {
              episodes: true,
            },
          },
        },
      });

      this.logger.log(`Found ${tvShowRequests.length} TV show requests to scan`);

      for (const request of tvShowRequests) {
        try {
          // Delegate to individual request scanning
          const requestResults = await this.scanTvShowRequest(request.id);
          results.seasonsScanned += request.tvShowSeasons.length;
          results.episodesUpdated += requestResults.episodesUpdated;
          results.episodesMarkedMissing += requestResults.episodesMarkedMissing;
        } catch (error) {
          this.logger.error(`Error scanning seasons for ${request.title}:`, error);
          results.errors++;
        }
      }

      this.logger.log(`Season scanning completed. Scanned ${results.seasonsScanned} seasons, updated ${results.episodesUpdated} episodes, marked ${results.episodesMarkedMissing} episodes as missing`);

      if (results.episodesMarkedMissing > 0) {
        this.logger.log(`🔍 Found ${results.episodesMarkedMissing} missing episode files that were previously completed`);
      }
      return results;
    } catch (error) {
      this.logger.error('Error during season scanning:', error);
      throw error;
    }
  }

  /**
   * Scan a specific TV show request
   * First ensures seasons and episodes are populated, then scans for completed episodes
   */
  async scanTvShowRequest(requestId: string): Promise<{ episodesUpdated: number; episodesMarkedMissing: number }> {
    // Several things scan a show (the re-index, the metadata refresh, a
    // finished download, organizing by hand) and they can land together. Two
    // scans of one show at once both try to create the same seasons and
    // episodes, so a show's scans run one after the other.
    const previous = this.scansInFlight.get(requestId) ?? Promise.resolve();
    const scan = previous.catch(() => undefined).then(() => this.scanTvShowRequestNow(requestId));
    this.scansInFlight.set(requestId, scan);

    try {
      return await scan;
    } finally {
      if (this.scansInFlight.get(requestId) === scan) {
        this.scansInFlight.delete(requestId);
      }
    }
  }

  private async scanTvShowRequestNow(requestId: string): Promise<{ episodesUpdated: number; episodesMarkedMissing: number }> {
    const results = { episodesUpdated: 0, episodesMarkedMissing: 0 };

    try {
      const include = { tvShowSeasons: { include: { episodes: true } } };
      let request = await this.prisma.requestedTorrent.findUnique({ where: { id: requestId }, include });

      if (!request || request.contentType !== ContentType.TV_SHOW) {
        this.logger.warn(`Request ${requestId} is not a TV show or not found`);
        return results;
      }

      // If no seasons exist, populate them first
      if (request.tvShowSeasons.length === 0 && request.tmdbId) {
        this.logger.log(`No seasons found for ${request.title}, populating season data first`);
        await this.tvShowMetadataService.populateSeasonData(requestId);
        request = (await this.prisma.requestedTorrent.findUnique({ where: { id: requestId }, include }))!;
      }

      const showDirectories = await this.findShowDirectories(request);

      // Not finding the show (or finding its folder empty) is not evidence that
      // episodes were deleted: the folder may be named some way we don't expect,
      // or the library may not be mounted. Only a show we can see is compared.
      if (showDirectories.length === 0) {
        this.logger.debug(`No library folder found for ${request.title}, leaving its episodes as they are`);
        return results;
      }

      const episodesOnDisk = await this.detectEpisodes(showDirectories);
      if (episodesOnDisk.size === 0) {
        this.logger.debug(`No episode files found for ${request.title} in ${showDirectories.join(', ')}, leaving its episodes as they are`);
        return results;
      }

      // Without a TMDB ID there is no season list to start from, so the
      // seasons on disk are the seasons
      if (!request.tmdbId) {
        for (const seasonNumber of episodesOnDisk.keys()) {
          if (seasonNumber > 0 && !request.tvShowSeasons.some(season => season.seasonNumber === seasonNumber)) {
            const created = await this.prisma.tvShowSeason.create({
              data: { requestedTorrentId: request.id, seasonNumber },
            });
            request.tvShowSeasons.push({ ...created, episodes: [] });
          }
        }
      }

      for (const season of request.tvShowSeasons) {
        const seasonResults = await this.applySeasonScan(request, season, episodesOnDisk.get(season.seasonNumber) ?? new Set());
        results.episodesUpdated += seasonResults.episodesUpdated;
        results.episodesMarkedMissing += seasonResults.episodesMarkedMissing;
      }

      return results;
    } catch (error) {
      this.logger.error(`Error scanning TV show request ${requestId}:`, error);
      throw error;
    }
  }

  /**
   * Bring one season's episodes in line with the episode numbers found on disk
   */
  private async applySeasonScan(request: any, season: any, detected: Set<number>): Promise<{ episodesUpdated: number; episodesMarkedMissing: number }> {
    const results = { episodesUpdated: 0, episodesMarkedMissing: 0 };

    const toComplete = [...detected].filter(episodeNumber => {
      const episode = season.episodes.find(ep => ep.episodeNumber === episodeNumber);
      return !episode || episode.status !== EpisodeStatus.COMPLETED;
    });

    if (toComplete.length > 0) {
      const knownEpisodes = await this.getKnownEpisodes(request, season.seasonNumber);

      for (const episodeNumber of toComplete) {
        if (knownEpisodes && !knownEpisodes.has(episodeNumber)) {
          this.logger.warn(`Found file for episode ${episodeNumber} of ${request.title} S${season.seasonNumber}, but episode not found in TMDB. Skipping.`);
          continue;
        }

        const episode = season.episodes.find(ep => ep.episodeNumber === episodeNumber);
        if (episode) {
          await this.prisma.tvShowEpisode.update({
            where: { id: episode.id },
            data: { status: EpisodeStatus.COMPLETED, updatedAt: new Date() },
          });
          this.logger.debug(`Updated episode ${episodeNumber} of ${request.title} S${season.seasonNumber} to COMPLETED`);
        } else {
          const known = knownEpisodes?.get(episodeNumber);
          await this.prisma.tvShowEpisode.create({
            data: {
              tvShowSeasonId: season.id,
              episodeNumber,
              title: known?.name || null,
              airDate: known?.air_date ? new Date(known.air_date) : null,
              status: EpisodeStatus.COMPLETED,
            },
          });
          this.logger.log(`Created and completed episode ${episodeNumber} for ${request.title} S${season.seasonNumber}`);
        }
        results.episodesUpdated++;
      }
    }

    // Episodes that were completed but no longer have a file
    for (const episode of season.episodes) {
      if (episode.status === EpisodeStatus.COMPLETED && !detected.has(episode.episodeNumber)) {
        await this.prisma.tvShowEpisode.update({
          where: { id: episode.id },
          data: { status: EpisodeStatus.PENDING, updatedAt: new Date() },
        });

        this.logger.log(`Episode ${episode.episodeNumber} of ${request.title} S${season.seasonNumber} file is missing, marked as PENDING`);
        results.episodesUpdated++;
        results.episodesMarkedMissing++;
      }
    }

    await this.updateSeasonStatusFromEpisodes(season.id);

    return results;
  }

  /**
   * Every library folder that holds this show: where the organization rule
   * puts it, where its files were actually organized to, and any folder in
   * the TV library named after it.
   */
  private async findShowDirectories(request: any): Promise<string[]> {
    const settings = await this.organizationRulesService.getSettings();
    const tvShowsPath = path.resolve(settings.tvShowsPath || `${settings.libraryPath}/tv-shows`);
    const candidates = new Set<string>();

    try {
      const organized = await this.organizationRulesService.generateOrganizedPath({
        contentType: ContentType.TV_SHOW,
        title: request.title,
        year: request.year ?? undefined,
        originalPath: '',
        fileName: '',
      });
      candidates.add(path.resolve(organized.folderPath));
    } catch (error) {
      this.logger.debug(`No organization rule path for ${request.title}: ${error.message}`);
    }

    const organizedFiles = await this.prisma.organizedFile.findMany({
      where: { requestedTorrentId: request.id, contentType: ContentType.TV_SHOW },
      select: { organizedPath: true },
    });
    for (const file of organizedFiles) {
      let directory = path.dirname(path.resolve(file.organizedPath));
      if (parseSeasonFromFolderName(path.basename(directory)) !== null) {
        directory = path.dirname(directory);
      }
      candidates.add(directory);
    }

    const wantedTitle = normalizeShowTitle(request.title);
    if (wantedTitle) {
      let entries: import('fs').Dirent[] = [];
      try {
        entries = await fs.readdir(tvShowsPath, { withFileTypes: true });
      } catch {
        this.logger.debug(`TV library is not readable: ${tvShowsPath}`);
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || normalizeShowTitle(entry.name) !== wantedTitle) {
          continue;
        }
        // "Show (2004)" is not the "Show" requested from 2019
        const folderYear = parseYearFromFolderName(entry.name);
        if (folderYear && request.year && folderYear !== request.year) {
          continue;
        }
        candidates.add(path.join(tvShowsPath, entry.name));
      }
    }

    const directories: string[] = [];
    for (const candidate of candidates) {
      // A file organized straight into the library root does not make the
      // whole library this show
      if (candidate === tvShowsPath || tvShowsPath.startsWith(candidate + path.sep)) {
        continue;
      }
      try {
        if ((await fs.stat(candidate)).isDirectory()) {
          directories.push(candidate);
        }
      } catch {
        // Not there
      }
    }

    return directories;
  }

  /**
   * The episodes present in a show's folders, by season. Files are read by
   * their own name first, then by the season folder they sit in.
   */
  private async detectEpisodes(showDirectories: string[]): Promise<Map<number, Set<number>>> {
    const episodesBySeason = new Map<number, Set<number>>();

    for (const showDirectory of showDirectories) {
      for (const filePath of await this.getMediaFilesInDirectory(showDirectory)) {
        const fileName = path.basename(filePath);
        if (/sample/i.test(fileName)) {
          continue;
        }

        const folders = path.relative(showDirectory, path.dirname(filePath)).split(path.sep).reverse();
        const folderSeason = folders.map(parseSeasonFromFolderName).find(season => season !== null) ?? null;

        const parsed = parseEpisodesFromFileName(fileName, folderSeason);
        if (!parsed) {
          this.logger.debug(`Could not tell which episode this is: ${filePath}`);
          continue;
        }

        const episodes = episodesBySeason.get(parsed.season) ?? new Set<number>();
        parsed.episodes.forEach(episode => episodes.add(episode));
        episodesBySeason.set(parsed.season, episodes);
      }
    }

    return episodesBySeason;
  }

  /**
   * Get all media files in a directory recursively. A folder that cannot be
   * read throws: a partial listing would look like deleted episodes.
   */
  private async getMediaFilesInDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await this.getMediaFilesInDirectory(fullPath)));
      } else if (MEDIA_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Update season status based on episode completion
   */
  private async updateSeasonStatusFromEpisodes(seasonId: string): Promise<void> {
    try {
      const season = await this.prisma.tvShowSeason.findUnique({
        where: { id: seasonId },
        include: { episodes: true },
      });

      if (!season || season.episodes.length === 0) {
        return;
      }

      const completedEpisodes = season.episodes.filter(ep => ep.status === 'COMPLETED');
      const totalEpisodes = season.episodes.length;

      let newStatus: string;
      if (completedEpisodes.length === totalEpisodes) {
        newStatus = 'COMPLETED';
      } else if (completedEpisodes.length > 0) {
        newStatus = 'DOWNLOADING'; // Use DOWNLOADING to represent partially completed seasons
      } else {
        newStatus = 'PENDING';
      }

      // Only update if status has changed
      if (season.status !== newStatus) {
        await this.prisma.tvShowSeason.update({
          where: { id: seasonId },
          data: {
            status: newStatus as any,
            updatedAt: new Date(),
          },
        });

        this.logger.debug(`Updated season ${seasonId} status to ${newStatus} (${completedEpisodes.length}/${totalEpisodes} episodes completed)`);
      }
    } catch (error) {
      this.logger.error(`Error updating season status for ${seasonId}:`, error);
    }
  }

  /**
   * The episodes TMDB lists for a season, by number. Null when that cannot be
   * checked (no TMDB ID or key, or the request failed), in which case a file
   * on disk is taken at its word.
   */
  private async getKnownEpisodes(request: any, seasonNumber: number): Promise<Map<number, TMDBEpisode> | null> {
    try {
      const apiKeysConfig = await this.appConfigService.getApiKeysConfig();
      if (!apiKeysConfig.tmdbApiKey || !request.tmdbId) {
        this.logger.debug(`TMDB API key or TMDB ID not available for ${request.title}. Skipping TMDB validation.`);
        return null;
      }

      const seasonDetails = await this.fetchSeasonDetailsFromTMDB(request.tmdbId, seasonNumber, apiKeysConfig.tmdbApiKey);
      if (!seasonDetails?.episodes) {
        this.logger.warn(`Could not fetch season ${seasonNumber} details from TMDB for ${request.title}`);
        return null;
      }

      return new Map(seasonDetails.episodes.map(episode => [episode.episode_number, episode]));
    } catch (error) {
      this.logger.error(`Error validating episodes with TMDB for ${request.title} S${seasonNumber}:`, error);
      return null;
    }
  }

  /**
   * Fetch season details from TMDB
   */
  private async fetchSeasonDetailsFromTMDB(tmdbId: number, seasonNumber: number, apiKey: string): Promise<{ episodes: TMDBEpisode[] } | null> {
    try {
      const response = await fetch(
        `${this.tmdbBaseUrl}/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKey}`
      );

      if (!response.ok) {
        this.logger.warn(`TMDB API returned ${response.status} for season ${seasonNumber} of TV show ${tmdbId}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error fetching season details from TMDB: ${error.message}`);
      return null;
    }
  }
}
