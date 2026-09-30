import { TorrentResult } from '../interfaces/external-api.interface';

export interface MusicReleaseTarget {
  artist: string;
  album: string;
  year?: number | null;
}

export type AudioFormat = 'FLAC_24' | 'FLAC' | 'MP3_320' | 'MP3_V0' | 'MP3' | 'AAC' | 'UNKNOWN';

/** Lossless first, then the best lossy encodes. */
const FORMAT_SCORES: Record<AudioFormat, number> = {
  FLAC_24: 45,
  FLAC: 40,
  MP3_320: 25,
  MP3_V0: 22,
  MP3: 10,
  AAC: 8,
  UNKNOWN: 0,
};

/** Multi-album bundles and video: never the album you asked for. */
const BUNDLE = /\b(discography|discografia|anthology|complete (albums|works|collection)|collection|box ?set|\d+ albums)\b/i;
const VIDEO = /\b(2160p|1080p|720p|480p|x264|x265|h\.?264|hevc|bluray|blu-ray|dvd|mkv|mp4|avi|concert film)\b/i;

/** Letters that Unicode normalization doesn't decompose into ASCII. */
const TRANSLITERATE: Record<string, string> = { æ: 'ae', ø: 'o', œ: 'oe', ß: 'ss', ð: 'd', þ: 'th', ł: 'l', đ: 'd' };

function tokens(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[æøœßðþłđ]/g, (c) => TRANSLITERATE[c])
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !['the', 'a', 'an', 'and', 'of'].includes(t));
}

export function detectAudioFormat(title: string): AudioFormat {
  const t = title.toLowerCase();
  if (/\bflac\b|\blossless\b|\balac\b/.test(t)) {
    return /\b24 ?bit\b|\b24-?(44|48|88|96|176|192)\b|\bhi-?res\b/.test(t) ? 'FLAC_24' : 'FLAC';
  }
  if (/\bmp3\b|\bcbr\b|\bvbr\b|\bv0\b|\b320\b/.test(t)) {
    if (/\b320\b/.test(t)) return 'MP3_320';
    if (/\bv0\b/.test(t)) return 'MP3_V0';
    return 'MP3';
  }
  if (/\baac\b|\bm4a\b/.test(t)) return 'AAC';
  return 'UNKNOWN';
}

/**
 * Keeps releases that are this artist's album — every word of both names in
 * the title — and ranks them: lossless over lossy, then the release year, then
 * seeders. Discographies, collections and video are dropped, unless the album
 * itself is called that.
 */
export function rankMusicReleases(torrents: TorrentResult[], target: MusicReleaseTarget): TorrentResult[] {
  const artistTokens = tokens(target.artist);
  const albumTokens = tokens(target.album);
  const albumIsBundle = BUNDLE.test(target.album);

  return torrents
    .filter((torrent) => {
      const titleTokens = new Set(tokens(torrent.title));
      const matches = (words: string[]) => words.length > 0 && words.every((word) => titleTokens.has(word));
      if (!matches(artistTokens) || !matches(albumTokens)) return false;
      if (!albumIsBundle && BUNDLE.test(torrent.title)) return false;
      return !VIDEO.test(torrent.title);
    })
    .map((torrent) => {
      let score = FORMAT_SCORES[detectAudioFormat(torrent.title)];
      if (target.year && new RegExp(`\\b${target.year}\\b`).test(torrent.title)) score += 5;
      if (/\b(web|cd|vinyl)\b/i.test(torrent.title)) score += 2;
      score += Math.min(20, Math.log2(1 + Math.max(0, torrent.seeders)) * 3);
      return { torrent, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ torrent }) => torrent);
}
