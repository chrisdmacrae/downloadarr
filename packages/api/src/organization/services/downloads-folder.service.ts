import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { ContentType, RequestStatus } from '../../../generated/prisma';
import { DownloadOrganizationService, OrganizeOutcome, OrganizeTarget } from './download-organization.service';
import { OrganizationRulesService } from './organization-rules.service';
import { SeasonScanningService } from '../../torrents/services/season-scanning.service';
import { RequestLifecycleOrchestrator } from '../../torrents/services/request-lifecycle-orchestrator.service';
import { Aria2Service } from '../../download/aria2.service';
import { downloadRoot, fromAria2Path } from '../../common/utils/aria2-paths';
import { normalizeShowTitle } from '../../common/utils/episode-files';

export interface DownloadsFolderEntry {
  /** Relative to the downloads folder; what `organize` takes back. */
  path: string;
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  fileCount: number;
  mediaFileCount: number;
  modifiedAt: string;
  /** From the subfolder it sits in (movies, tv-shows, games, music). */
  suggestedContentType: ContentType | null;
  /** aria2 has it as a running, queued or paused download; it cannot be organized yet. */
  inProgress: boolean;
  /**
   * aria2 never finished it and no longer has it: a control file is left
   * beside partial files. It can be organized, but may not be whole.
   */
  incomplete: boolean;
  /** A guess from the release name, to prefill the form. */
  detected: { title: string; year?: number; season?: number };
  /** A request whose title matches the guess. */
  suggestedRequestId: string | null;
}

export interface OrganizeDownloadRequest {
  path: string;
  /** Map the download to this request; its type, title and year are used. */
  requestId?: string;
  contentType?: ContentType;
  title?: string;
  year?: number;
  /** TV: for files that do not name their season. */
  season?: number;
  platform?: string;
  artist?: string;
  /** Organize a download aria2 abandoned part-way, accepting it may not be whole. */
  allowIncomplete?: boolean;
}

export interface OrganizeDownloadResult {
  success: boolean;
  message: string;
  organized: number;
  skipped: string[];
  failed: Array<{ path: string; error: string }>;
}

const TYPE_FOLDERS: Record<string, ContentType | null> = {
  movies: ContentType.MOVIE,
  'tv-shows': ContentType.TV_SHOW,
  games: ContentType.GAME,
  music: ContentType.MUSIC,
  other: null,
};

const MEDIA_EXTENSIONS = [
  '.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
  '.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a',
];

/** A request as far as matching a download to it goes. */
interface CandidateRequest {
  id: string;
  title: string;
  year: number | null;
  contentType: ContentType;
  status: RequestStatus;
  torrentDownloads: Array<{ id: string }>;
}

// Requests an automatic match may be organized into: open, and not in the
// middle of anything the app itself is doing for them
const AUTO_MATCHABLE: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.FOUND,
  RequestStatus.FAILED,
  RequestStatus.EXPIRED,
];

// A download has to have sat untouched this long before it is matched
// automatically, so one that only just finished is left to its own tracking
const AUTO_MATCH_AFTER_MS = 15 * 60 * 1000;

// Requests a manual organize may complete outright: nothing of theirs is running
const SETTLED_BY_HAND: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.SEARCHING,
  RequestStatus.FOUND,
  RequestStatus.FAILED,
  RequestStatus.CANCELLED,
  RequestStatus.EXPIRED,
];

/**
 * What is sitting in the downloads folder, and moving it into the library by
 * hand. Downloads end up stranded there when the app loses track of them: the
 * request failed or was cancelled, aria2 forgot the download, or it was added
 * outside the app. Nothing else looks at the folder itself.
 */
@Injectable()
export class DownloadsFolderService {
  private readonly logger = new Logger(DownloadsFolderService.name);
  private isAutoOrganizing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationRulesService: OrganizationRulesService,
    private readonly downloadOrganizationService: DownloadOrganizationService,
    private readonly seasonScanningService: SeasonScanningService,
    @Inject(forwardRef(() => RequestLifecycleOrchestrator))
    private readonly orchestrator: RequestLifecycleOrchestrator,
    @Inject(forwardRef(() => Aria2Service))
    private readonly aria2Service: Aria2Service,
  ) {}

  async list(): Promise<DownloadsFolderEntry[]> {
    return (await this.scan())
      .map(({ entry }) => entry)
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  /**
   * Organizes the downloads that can only be one thing: a settled entry in a
   * type folder whose name matches exactly one open request of that type.
   * Anything less certain is left in the list for a person to map.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async organizeMatchedDownloads(): Promise<void> {
    if (this.isAutoOrganizing) {
      return;
    }

    this.isAutoOrganizing = true;
    try {
      const settings = await this.organizationRulesService.getSettings();
      if (!settings.organizeOnComplete) {
        return;
      }

      for (const { entry, typeFolder, matches } of await this.scan()) {
        const [request] = matches;
        const settled = Date.now() - new Date(entry.modifiedAt).getTime() >= AUTO_MATCH_AFTER_MS;

        if (
          entry.inProgress ||
          // A part-finished download is a person's call
          entry.incomplete ||
          !settled ||
          !typeFolder ||
          matches.length !== 1 ||
          !AUTO_MATCHABLE.includes(request.status) ||
          // Its own download is still being tracked, and will bring these files in itself
          request.torrentDownloads.length > 0 ||
          (entry.detected.year && request.year && entry.detected.year !== request.year)
        ) {
          continue;
        }

        try {
          this.logger.log(`${entry.path} matches only the request for "${request.title}" (${request.status}); organizing it`);
          await this.organize({ path: entry.path, requestId: request.id, season: entry.detected.season }, { holdOnFailure: true });
        } catch (error) {
          this.logger.warn(`Could not organize ${entry.path} automatically: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Error matching the downloads folder to requests:', error);
    } finally {
      this.isAutoOrganizing = false;
    }
  }

  private async scan(): Promise<Array<{ entry: DownloadsFolderEntry; typeFolder: ContentType | null; matches: CandidateRequest[] }>> {
    const root = downloadRoot();
    const found: Array<{ entry: DownloadsFolderEntry; typeFolder: ContentType | null; matches: CandidateRequest[] } | null> = [];

    const requests = await this.prisma.requestedTorrent.findMany({
      where: { status: { not: RequestStatus.COMPLETED } },
      select: {
        id: true,
        title: true,
        year: true,
        contentType: true,
        status: true,
        torrentDownloads: { where: { status: 'DOWNLOADING' }, select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const active = await this.activeDownloadPaths();
    const describe = async (relativePath: string, typeFolder: ContentType | null) => {
      try {
        found.push(await this.describe(root, relativePath, typeFolder, requests, active));
      } catch (error) {
        // One unreadable entry (a broken link, a folder removed mid-scan) must not hide the rest
        this.logger.debug(`Skipping ${relativePath} in the downloads folder: ${error.message}`);
      }
    };

    for (const top of await this.readDirectory(root)) {
      if (top.isDirectory() && top.name in TYPE_FOLDERS) {
        for (const child of await this.readDirectory(path.join(root, top.name))) {
          await describe(path.join(top.name, child.name), TYPE_FOLDERS[top.name]);
        }
      } else {
        await describe(top.name, null);
      }
    }

    return found.filter((item): item is NonNullable<typeof item> => item !== null);
  }

  async organize(dto: OrganizeDownloadRequest, { holdOnFailure = false }: { holdOnFailure?: boolean } = {}): Promise<OrganizeDownloadResult> {
    const root = downloadRoot();
    const absolutePath = path.resolve(root, dto.path || '');

    if (!absolutePath.startsWith(root + path.sep)) {
      throw new Error('The path must be inside the downloads folder');
    }
    if (path.dirname(absolutePath) === root && path.basename(absolutePath) in TYPE_FOLDERS) {
      throw new Error('Pick a download inside this folder, not the folder itself');
    }

    const stats = await fs.stat(absolutePath).catch(() => null);
    if (!stats) {
      throw new Error('That download is no longer in the downloads folder');
    }
    const state = await this.downloadState(absolutePath, await this.activeDownloadPaths());
    if (state.inProgress) {
      throw new Error('aria2 is still downloading this. Wait for it to finish, or cancel it first.');
    }
    if (state.incomplete && !dto.allowIncomplete) {
      throw new Error('aria2 never finished this download, so its files may not be whole. Confirm to organize it anyway.');
    }

    const request = dto.requestId
      ? await this.prisma.requestedTorrent.findUnique({ where: { id: dto.requestId } })
      : null;
    if (dto.requestId && !request) {
      throw new Error(`Request ${dto.requestId} not found`);
    }

    const target: OrganizeTarget = request
      ? {
          contentType: request.contentType,
          title: request.title,
          year: request.year || undefined,
          season: dto.season || request.season || undefined,
          platform: dto.platform || request.platform || undefined,
          artist: request.artist || undefined,
          requestId: request.id,
        }
      : {
          contentType: dto.contentType!,
          title: (dto.title || '').trim(),
          year: dto.year || undefined,
          season: dto.season || undefined,
          platform: dto.platform || undefined,
          artist: dto.artist?.trim() || undefined,
        };

    if (!target.contentType || !target.title) {
      throw new Error('Say what this is: pick a request, or give a content type and a title');
    }

    const files = stats.isDirectory() ? await this.listFiles(absolutePath) : [absolutePath];
    const outcome = await this.downloadOrganizationService.organizeFiles(files, target);

    this.logger.log(`Organized ${dto.path} by hand as "${target.title}": ${outcome.organized.length} moved, ${outcome.skipped.length} skipped, ${outcome.failed.length} failed`);

    if (request) {
      await this.settleRequest(request, outcome, holdOnFailure);
    }

    const failed = outcome.failed.map(file => ({ path: path.relative(root, file.path), error: file.error }));
    return {
      success: failed.length === 0 && outcome.organized.length > 0,
      message: failed.length > 0
        ? `${outcome.organized.length} files moved, ${failed.length} could not be moved`
        : outcome.organized.length > 0
          ? `${outcome.organized.length} files moved to the library`
          : 'There was nothing to move',
      organized: outcome.organized.length,
      skipped: outcome.skipped.map(file => path.relative(root, file)),
      failed,
    };
  }

  /**
   * Bring the request in line with what is now in the library: a show has its
   * episodes counted, and a request with no download of its own left is
   * completed (or, for a show still missing episodes, sent back to searching).
   */
  private async settleRequest(
    request: { id: string; title: string; contentType: ContentType; status: RequestStatus },
    outcome: OrganizeOutcome,
    holdOnFailure: boolean,
  ): Promise<void> {
    try {
      if (request.contentType === ContentType.TV_SHOW) {
        await this.seasonScanningService.scanTvShowRequest(request.id);
      }

      // Nobody watched an automatic match fail, so it is held where it will be seen
      if (outcome.failed.length > 0 && holdOnFailure) {
        const [first] = outcome.failed;
        const reason = `${outcome.failed.length} files could not be moved. First: ${path.basename(first.path)}: ${first.error}`;
        await this.prisma.requestedTorrent.update({
          where: { id: request.id },
          data: { organizeError: reason, unorganizedFiles: outcome.failed.map(file => file.path) },
        });
        await this.orchestrator.markAsOrganizeFailed(request.id, reason);
        return;
      }

      if (outcome.failed.length > 0 || outcome.organized.length === 0) {
        return;
      }

      if (request.status === RequestStatus.ORGANIZE_FAILED) {
        await this.prisma.requestedTorrent.update({
          where: { id: request.id },
          data: { organizeError: null, unorganizedFiles: [] },
        });
        await this.orchestrator.markAsCompleted(request.id);
      } else if (request.contentType !== ContentType.TV_SHOW && SETTLED_BY_HAND.includes(request.status)) {
        await this.orchestrator.markAsManuallyOrganized(request.id);
      }
    } catch (error) {
      // The files are in the library; the request catching up is secondary
      this.logger.warn(`Organized files for ${request.title}, but could not update its request: ${error.message}`);
    }
  }

  private async describe(
    root: string,
    relativePath: string,
    suggestedContentType: ContentType | null,
    requests: CandidateRequest[],
    active: string[] | null,
  ): Promise<{ entry: DownloadsFolderEntry; typeFolder: ContentType | null; matches: CandidateRequest[] } | null> {
    const absolutePath = path.join(root, relativePath);
    const stats = await fs.stat(absolutePath);
    const files = stats.isDirectory() ? await this.listFiles(absolutePath) : [absolutePath];

    // What organizing leaves behind on purpose (release notes, samples) is
    // not a download waiting to be organized
    if (files.every(file => this.downloadOrganizationService.isLeftBehind(file))) {
      return null;
    }

    let sizeBytes = 0;
    let modified = stats.mtimeMs;
    let mediaFileCount = 0;
    for (const file of files) {
      const fileStats = await fs.stat(file).catch(() => null);
      if (!fileStats) continue;
      sizeBytes += fileStats.size;
      modified = Math.max(modified, fileStats.mtimeMs);
      if (MEDIA_EXTENSIONS.includes(path.extname(file).toLowerCase())) mediaFileCount++;
    }

    const name = path.basename(relativePath);
    const detected = guessFromReleaseName(name);
    const wanted = normalizeShowTitle(detected.title);
    const matches = wanted
      ? requests.filter(request =>
          normalizeShowTitle(request.title) === wanted &&
          (!suggestedContentType || request.contentType === suggestedContentType))
      : [];
    const match = matches[0];

    const entry: DownloadsFolderEntry = {
      path: relativePath,
      name,
      isDirectory: stats.isDirectory(),
      sizeBytes,
      fileCount: files.length,
      mediaFileCount,
      modifiedAt: new Date(modified).toISOString(),
      suggestedContentType: suggestedContentType ?? match?.contentType ?? null,
      ...(await this.downloadState(absolutePath, active)),
      detected,
      suggestedRequestId: match?.id ?? null,
    };

    return { entry, typeFolder: suggestedContentType, matches };
  }

  /**
   * Where aria2's running, queued and paused downloads are writing, or null
   * when aria2 cannot be asked.
   */
  private async activeDownloadPaths(): Promise<string[] | null> {
    try {
      const [active, waiting] = await Promise.all([
        this.aria2Service.getActiveDownloads(),
        this.aria2Service.getWaitingDownloads(0, 1000),
      ]);
      return [...active, ...waiting].flatMap(download =>
        (download.files ?? []).filter(file => file.path).map(file => fromAria2Path(file.path)),
      );
    } catch {
      return null;
    }
  }

  /**
   * Whether aria2 is working on an entry, or abandoned it part-way. aria2
   * itself is the authority on what is running. Its "<name>.aria2" control
   * file only says a download was never finished: it stays behind for good
   * when aria2 loses the download, so on its own it means "incomplete", and
   * means "in progress" only when aria2 cannot be asked.
   */
  private async downloadState(absolutePath: string, active: string[] | null): Promise<{ inProgress: boolean; incomplete: boolean }> {
    const hasControlFile = await this.hasControlFile(absolutePath);

    if (active === null) {
      return { inProgress: hasControlFile, incomplete: false };
    }

    const inProgress = active.some(file => file === absolutePath || file.startsWith(absolutePath + path.sep));
    return { inProgress, incomplete: hasControlFile && !inProgress };
  }

  private async hasControlFile(absolutePath: string): Promise<boolean> {
    if (await fs.access(`${absolutePath}.aria2`).then(() => true, () => false)) {
      return true;
    }
    const stats = await fs.stat(absolutePath).catch(() => null);
    if (!stats?.isDirectory()) {
      return false;
    }
    return (await this.listFiles(absolutePath, true)).some(file => file.endsWith('.aria2'));
  }

  /** Entries worth showing: no hidden files, no aria2 control files. */
  private async readDirectory(directory: string) {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    return entries.filter(entry => !entry.name.startsWith('.') && !entry.name.endsWith('.aria2'));
  }

  private async listFiles(directory: string, includeControlFiles = false): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.listFiles(fullPath, includeControlFiles)));
      } else if (includeControlFiles || !entry.name.endsWith('.aria2')) {
        files.push(fullPath);
      }
    }
    return files;
  }
}

/** A title, year and season out of a release name such as "Show.Name.S02.1080p.WEB.x265-GRP". */
export function guessFromReleaseName(name: string): { title: string; year?: number; season?: number } {
  const spaced = name
    .replace(/\.[a-z0-9]{2,4}$/i, match => (/^\.(mkv|mp4|avi|mov|m4v|wmv|flac|mp3|iso|zip|rar|7z)$/i.test(match) ? '' : match))
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const season = spaced.match(/\bS(\d{1,2})(?:E\d{1,3})?\b/i) ?? spaced.match(/\bSeason (\d{1,2})\b/i);
  // A year in brackets is the release year. Otherwise it is the last one in
  // the name: "Blade Runner 2049 2017" was released in 2017.
  const plainYears = [...spaced.matchAll(/\b((?:19|20)\d{2})\b(?!p)/g)];
  const year = spaced.match(/[\[(]((?:19|20)\d{2})[\])]/) ?? plainYears[plainYears.length - 1];
  const quality = spaced.match(/\b(480p|720p|1080p|2160p|4k|bluray|brrip|webrip|web-?dl|web|hdtv|dvdrip|remux|x264|x265|hevc|flac|mp3|repack|proper|complete)\b/i);

  // The title is whatever comes before the first thing that is not title.
  // A year at the very start is part of the title ("1923", "2001 A Space Odyssey").
  const cuts = [season?.index, year && year.index! > 0 ? year.index : undefined, quality?.index]
    .filter((index): index is number => index !== undefined && index > 0);
  const end = cuts.length > 0 ? Math.min(...cuts) : spaced.length;
  const title = spaced.slice(0, end).replace(/[\s\-([]+$/, '').trim();

  return {
    title: title || spaced,
    year: year && year.index! > 0 ? parseInt(year[1], 10) : undefined,
    season: season ? parseInt(season[1], 10) : undefined,
  };
}
