import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export type ResolvedTorrentLink =
  /** A real `magnet:` URI, to hand to aria2 as a magnet. */
  | { kind: 'magnet'; magnetUri: string }
  /** The bytes of a .torrent file, already fetched. */
  | { kind: 'torrent'; torrent: Buffer }
  /** Nothing to resolve — pass the URL to aria2 unchanged. */
  | { kind: 'url'; url: string };

/**
 * Turns an indexer link into something aria2 can actually start.
 *
 * Prowlarr never hands out an indexer's own URL: every `downloadUrl` and
 * `magnetUrl` in a search result is a signed link back through Prowlarr
 * (`{prowlarr}/{indexerId}/download?apikey=...&link=...`). Fetching one either
 * returns the .torrent bytes or 301s to the real `magnet:` URI — and aria2
 * cannot follow a redirect that leaves the http scheme, so the hop has to
 * happen here.
 *
 * Resolving in the API rather than in aria2 also keeps the indexer fetch off
 * the VPN, which matters when aria2 runs in `network_mode: service:vpn`.
 */
@Injectable()
export class TorrentLinkResolverService {
  private readonly logger = new Logger(TorrentLinkResolverService.name);

  constructor(private readonly httpService: HttpService) {}

  async resolve(url: string): Promise<ResolvedTorrentLink> {
    if (url.startsWith('magnet:')) {
      return { kind: 'magnet', magnetUri: url };
    }

    if (!/^https?:\/\//i.test(url)) {
      return { kind: 'url', url };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          maxRedirects: 0,
          // 3xx has to reach us rather than throwing, so the magnet redirect
          // can be read off the Location header.
          validateStatus: (status) => status < 400,
        }),
      );

      if (response.status >= 300) {
        const location = response.headers['location'];

        if (typeof location === 'string' && location.startsWith('magnet:')) {
          return { kind: 'magnet', magnetUri: location };
        }

        // A redirect somewhere else - let aria2 follow it itself.
        return { kind: 'url', url: typeof location === 'string' ? location : url };
      }

      const body = Buffer.from(response.data);

      // Some indexers answer a .torrent request with the magnet as the body.
      if (body.subarray(0, 7).toString('ascii') === 'magnet:') {
        return { kind: 'magnet', magnetUri: body.toString('utf8').trim() };
      }

      // Bencoded torrents start with a dictionary marker.
      if (body.length > 0 && body[0] === 0x64) {
        return { kind: 'torrent', torrent: body };
      }

      this.logger.warn(`Link ${url} returned ${body.length} bytes that are not a torrent - passing it to aria2 as-is`);
      return { kind: 'url', url };
    } catch (error) {
      this.logger.warn(`Could not resolve ${url} (${error.message}) - passing it to aria2 as-is`);
      return { kind: 'url', url };
    }
  }
}
