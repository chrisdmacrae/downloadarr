import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigurationService } from '../../config/services/app-configuration.service';
import { PrismaService } from '../../database/prisma.service';
import { isValidRedirectUri, isValidSpotifyClientId } from '../../music/clients/spotify.client';

export interface RecommendationApps {
  spotifyClientId: string | null;
  spotifyRedirectUri: string | null;
  traktClientId: string | null;
  traktClientSecret: string | null;
}

/** What the UI sees: the Trakt secret is write-only. */
export interface RecommendationAppsView {
  spotifyClientId: string | null;
  spotifyRedirectUri: string | null;
  traktClientId: string | null;
  hasTraktClientSecret: boolean;
}

/**
 * The Spotify and Trakt apps every profile signs in through. One per install:
 * each self-hoster registers their own with Spotify and Trakt.
 */
@Injectable()
export class RecommendationAppsService {
  constructor(
    private readonly config: AppConfigurationService,
    private readonly prisma: PrismaService,
  ) {}

  async get(): Promise<RecommendationApps> {
    const config = await this.config.getConfiguration();
    return {
      spotifyClientId: config.spotifyClientId,
      spotifyRedirectUri: config.spotifyRedirectUri,
      traktClientId: config.traktClientId,
      traktClientSecret: config.traktClientSecret,
    };
  }

  toView(apps: RecommendationApps): RecommendationAppsView {
    return {
      spotifyClientId: apps.spotifyClientId,
      spotifyRedirectUri: apps.spotifyRedirectUri,
      traktClientId: apps.traktClientId,
      hasTraktClientSecret: Boolean(apps.traktClientSecret),
    };
  }

  /** Omitted fields keep their value; an empty string clears one. */
  async update(input: Partial<Record<keyof RecommendationApps, string>>): Promise<RecommendationApps> {
    const config = await this.config.getConfiguration();
    const data: Partial<RecommendationApps> = {};
    for (const key of ['spotifyClientId', 'spotifyRedirectUri', 'traktClientId', 'traktClientSecret'] as const) {
      if (input[key] !== undefined) data[key] = input[key]!.trim() || null;
    }
    if (data.spotifyClientId && !isValidSpotifyClientId(data.spotifyClientId)) {
      throw new BadRequestException('That doesn’t look like a Spotify Client ID (32 letters and digits)');
    }
    if (data.spotifyRedirectUri && !isValidRedirectUri(data.spotifyRedirectUri)) {
      throw new BadRequestException('Spotify requires an https:// redirect URI');
    }
    await this.prisma.appConfiguration.update({ where: { id: config.id }, data });
    return this.get();
  }
}
