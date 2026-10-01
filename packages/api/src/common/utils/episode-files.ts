/**
 * Reading season and episode numbers out of library file and folder names.
 * The organizer keeps release file names by default, so this has to cope with
 * whatever a release group called the file.
 */

export interface ParsedEpisodes {
  season: number;
  /** More than one for a file that holds several episodes (S01E01E02). */
  episodes: number[];
}

const MAX_SEASON = 99;
const MAX_EPISODE = 999;

// S01E01, S01.E01, S01 E01, then any further episodes: E02, -E02 or -02
const SXXEYY = /(?<![a-z0-9])s(\d{1,2})[\s._-]?e(\d{1,3})((?:[\s._-]?e\d{1,3}|-\d{1,3}(?![\dpi]))*)(?!\d)/i;
// 1x01, kept away from resolutions such as 1920x1080
const NXNN = /(?<![a-z0-9])(\d{1,2})x(\d{2,3})(?![\dx])/i;
const SEASON_EPISODE_WORDS = /season[\s._-]*(\d{1,2})[\s._-]+.*?episode[\s._-]*(\d{1,3})(?!\d)/i;
// "E05" or "Episode 5": only trusted when the folder says which season it is
const EPISODE_ONLY = /(?:^|[\s._\-\[(])(?:episode|ep|e)[\s._-]?(\d{1,3})(?!\d)/i;

const SEASON_FOLDER = /^(?:season[\s._-]*|s)(\d{1,2})(?!\d)/i;

/** The season a folder name stands for ("Season 1", "Season 01", "S01"), if any. */
export function parseSeasonFromFolderName(folderName: string): number | null {
  const match = folderName.trim().match(SEASON_FOLDER);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * The season and episode(s) a file name stands for. `folderSeason` is the
 * season of the folder the file is in, used for names with no season of
 * their own ("Episode 05.mkv").
 */
export function parseEpisodesFromFileName(fileName: string, folderSeason?: number | null): ParsedEpisodes | null {
  const name = fileName.replace(/\.[a-z0-9]{2,4}$/i, '');

  const full = name.match(SXXEYY);
  if (full) {
    const first = parseInt(full[2], 10);
    const rest = [...full[3].matchAll(/(-?)[\s._]?(e?)(\d{1,3})/gi)];
    let episodes = [first, ...rest.map(match => parseInt(match[3], 10))];

    // "S01E01-E03" and "S01E01-03" are ranges; "S01E01E02" is a list
    if (rest.length === 1 && full[3].includes('-') && episodes[1] > first) {
      episodes = [];
      for (let episode = first; episode <= parseInt(rest[0][3], 10); episode++) {
        episodes.push(episode);
      }
    }

    return validated(parseInt(full[1], 10), episodes);
  }

  const crossed = name.match(NXNN);
  if (crossed) {
    return validated(parseInt(crossed[1], 10), [parseInt(crossed[2], 10)]);
  }

  const words = name.match(SEASON_EPISODE_WORDS);
  if (words) {
    return validated(parseInt(words[1], 10), [parseInt(words[2], 10)]);
  }

  if (folderSeason != null) {
    const episodeOnly = name.match(EPISODE_ONLY);
    if (episodeOnly) {
      return validated(folderSeason, [parseInt(episodeOnly[1], 10)]);
    }
  }

  return null;
}

function validated(season: number, episodes: number[]): ParsedEpisodes | null {
  const valid = [...new Set(episodes)].filter(episode => episode >= 1 && episode <= MAX_EPISODE);
  if (season < 0 || season > MAX_SEASON || valid.length === 0) {
    return null;
  }
  return { season, episodes: valid };
}

/**
 * A show title reduced to what survives being written as a folder name and
 * typed by hand: no accents, punctuation, year or leading article.
 */
export function normalizeShowTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[(\[]\s*\d{4}\s*[)\]]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The year in a folder name such as "Show (2019)" or "Show [2019]", if any. */
export function parseYearFromFolderName(folderName: string): number | null {
  const match = folderName.match(/[(\[]\s*(\d{4})\s*[)\]]/);
  return match ? parseInt(match[1], 10) : null;
}
