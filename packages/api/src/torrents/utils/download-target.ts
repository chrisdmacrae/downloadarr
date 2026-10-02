import { ContentType } from '../../../generated/prisma';

/** Where a request's download is put, under the download folder. */
export function downloadDestinationFor(contentType: ContentType): string {
  const baseDir = process.env.DOWNLOAD_PATH || '/downloads';

  if (contentType === ContentType.MOVIE) {
    return `${baseDir}/movies`;
  } else if (contentType === ContentType.TV_SHOW) {
    return `${baseDir}/tv-shows`;
  } else if (contentType === ContentType.GAME) {
    return `${baseDir}/games`;
  } else if (contentType === ContentType.MUSIC) {
    return `${baseDir}/music`;
  } else {
    return `${baseDir}/other`;
  }
}

/** A torrent title made safe to use as a download's name. */
export function sanitizeDownloadName(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}
