import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RecommendationProfile } from '../../../generated/prisma';

export interface TopArtist {
  name: string;
  mbid?: string | null;
  weight: number;
}

/**
 * The people recommendations are built for. Every install has at least one:
 * the migration creates "Me", and the last profile can't be deleted.
 */
@Injectable()
export class RecommendationProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<RecommendationProfile[]> {
    return this.prisma.recommendationProfile.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async get(id: string): Promise<RecommendationProfile> {
    const profile = await this.prisma.recommendationProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('No such profile');
    return profile;
  }

  /** The profiles a request covers: one, or every profile when none is given. */
  async scope(profileId?: string): Promise<RecommendationProfile[]> {
    return profileId ? [await this.get(profileId)] : this.list();
  }

  async create(name: string): Promise<RecommendationProfile> {
    return this.prisma.recommendationProfile.create({ data: { name: this.cleanName(name) } });
  }

  async rename(id: string, name: string): Promise<RecommendationProfile> {
    await this.get(id);
    return this.prisma.recommendationProfile.update({ where: { id }, data: { name: this.cleanName(name) } });
  }

  /** Deletes a profile with its accounts, recommendations and dismissals. */
  async remove(id: string): Promise<void> {
    await this.get(id);
    if ((await this.prisma.recommendationProfile.count()) <= 1) {
      throw new BadRequestException('Keep at least one profile');
    }
    await this.prisma.recommendationProfile.delete({ where: { id } });
  }

  topArtists(profile: RecommendationProfile): TopArtist[] {
    return Array.isArray(profile.musicTopArtists) ? (profile.musicTopArtists as unknown as TopArtist[]) : [];
  }

  private cleanName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Give the profile a name');
    return trimmed.slice(0, 60);
  }
}
