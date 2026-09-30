-- Recommendation profiles: every connected account, recommendation and
-- dismissal now belongs to a profile. Existing data moves to a profile named
-- "Me", so nothing needs reconnecting.

-- CreateTable
CREATE TABLE "public"."recommendation_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "musicTopArtists" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_profiles_pkey" PRIMARY KEY ("id")
);

INSERT INTO "public"."recommendation_profiles" ("id", "name", "updatedAt") VALUES ('default', 'Me', CURRENT_TIMESTAMP);

-- Carry over the old taste snapshot, strongest first.
UPDATE "public"."recommendation_profiles"
SET "musicTopArtists" = (
    SELECT jsonb_agg(jsonb_build_object('name', "name", 'mbid', "mbid", 'weight', "tasteWeight") ORDER BY "tasteWeight" DESC)
    FROM "public"."music_artists"
    WHERE "tasteWeight" > 0
)
WHERE "id" = 'default';

-- AlterTable
ALTER TABLE "public"."music_artists" DROP COLUMN "tasteWeight";

-- Spotify's app credentials move to the install, shared by every profile.
ALTER TABLE "public"."app_configuration" ADD COLUMN     "spotifyClientId" TEXT,
ADD COLUMN     "spotifyRedirectUri" TEXT,
ADD COLUMN     "traktClientId" TEXT,
ADD COLUMN     "traktClientSecret" TEXT;

UPDATE "public"."app_configuration"
SET "spotifyClientId" = s."clientId", "spotifyRedirectUri" = s."redirectUri"
FROM (SELECT "clientId", "redirectUri" FROM "public"."music_sources" WHERE "provider" = 'SPOTIFY' LIMIT 1) AS s;

-- music_sources becomes recommendation_sources, one account per provider per profile.
ALTER TYPE "public"."MusicSourceProvider" RENAME TO "RecommendationSourceProvider";
ALTER TYPE "public"."RecommendationSourceProvider" ADD VALUE 'TRAKT';

ALTER TABLE "public"."music_sources" RENAME TO "recommendation_sources";
ALTER TABLE "public"."recommendation_sources" RENAME CONSTRAINT "music_sources_pkey" TO "recommendation_sources_pkey";
DROP INDEX "public"."music_sources_provider_key";
ALTER TABLE "public"."recommendation_sources" DROP COLUMN "clientId",
DROP COLUMN "redirectUri",
ADD COLUMN     "profileId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "public"."recommendation_sources" ALTER COLUMN "profileId" DROP DEFAULT;

CREATE UNIQUE INDEX "recommendation_sources_profileId_provider_key" ON "public"."recommendation_sources"("profileId", "provider");

-- Recommendations and dismissals are per profile.
DROP INDEX "public"."music_recommendations_list_rank_idx";
ALTER TABLE "public"."music_recommendations" ADD COLUMN     "profileId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "public"."music_recommendations" ALTER COLUMN "profileId" DROP DEFAULT;
CREATE INDEX "music_recommendations_profileId_list_rank_idx" ON "public"."music_recommendations"("profileId", "list", "rank");

DROP INDEX "public"."music_dismissals_key_key";
ALTER TABLE "public"."music_dismissals" ADD COLUMN     "profileId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "public"."music_dismissals" ALTER COLUMN "profileId" DROP DEFAULT;
CREATE UNIQUE INDEX "music_dismissals_profileId_key_key" ON "public"."music_dismissals"("profileId", "key");

-- Movie and TV recommendations from Trakt.
CREATE TYPE "public"."VideoKind" AS ENUM ('MOVIE', 'TV');
CREATE TYPE "public"."VideoRecommendationList" AS ENUM ('RECOMMENDED', 'WATCHLIST');

-- CreateTable
CREATE TABLE "public"."video_recommendations" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "public"."VideoKind" NOT NULL,
    "list" "public"."VideoRecommendationList" NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tmdbId" INTEGER NOT NULL,
    "traktId" INTEGER,
    "imdbId" TEXT,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "poster" TEXT,
    "backdrop" TEXT,
    "overview" TEXT,
    "rating" DOUBLE PRECISION,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_dismissals" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "public"."VideoKind" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_recommendations_profileId_kind_list_rank_idx" ON "public"."video_recommendations"("profileId", "kind", "list", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "video_dismissals_profileId_kind_tmdbId_key" ON "public"."video_dismissals"("profileId", "kind", "tmdbId");

-- AddForeignKey
ALTER TABLE "public"."recommendation_sources" ADD CONSTRAINT "recommendation_sources_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."recommendation_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."music_recommendations" ADD CONSTRAINT "music_recommendations_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."recommendation_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."music_dismissals" ADD CONSTRAINT "music_dismissals_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."recommendation_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_recommendations" ADD CONSTRAINT "video_recommendations_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."recommendation_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_dismissals" ADD CONSTRAINT "video_dismissals_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."recommendation_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
