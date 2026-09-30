-- CreateEnum
CREATE TYPE "public"."MusicSourceProvider" AS ENUM ('LISTENBRAINZ', 'LASTFM');

-- CreateEnum
CREATE TYPE "public"."MusicRecommendationList" AS ENUM ('NEW_ARTISTS', 'FRESH_RELEASES', 'WEEKLY_PICKS', 'MOST_PLAYED');

-- CreateTable
CREATE TABLE "public"."music_sources" (
    "id" TEXT NOT NULL,
    "provider" "public"."MusicSourceProvider" NOT NULL,
    "username" TEXT NOT NULL,
    "apiKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."music_artists" (
    "id" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mbid" TEXT,
    "deezerId" INTEGER,
    "tasteWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."music_recommendations" (
    "id" TEXT NOT NULL,
    "list" "public"."MusicRecommendationList" NOT NULL,
    "rank" INTEGER NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistMbid" TEXT,
    "albumTitle" TEXT NOT NULL,
    "releaseGroupMbid" TEXT,
    "releaseDate" TEXT,
    "coverUrl" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."music_dismissals" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "music_sources_provider_key" ON "public"."music_sources"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "music_artists_nameKey_key" ON "public"."music_artists"("nameKey");

-- CreateIndex
CREATE INDEX "music_recommendations_list_rank_idx" ON "public"."music_recommendations"("list", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "music_dismissals_key_key" ON "public"."music_dismissals"("key");
