-- CreateEnum
CREATE TYPE "public"."SeasonStatus" AS ENUM ('PENDING', 'SEARCHING', 'FOUND', 'DOWNLOADING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."EpisodeStatus" AS ENUM ('PENDING', 'SEARCHING', 'FOUND', 'DOWNLOADING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."TorrentDownloadStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "public"."ContentType" ADD VALUE 'GAME';

-- AlterTable
ALTER TABLE "public"."requested_torrents" ADD COLUMN     "genre" TEXT,
ADD COLUMN     "igdbId" INTEGER,
ADD COLUMN     "isOngoing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "totalEpisodes" INTEGER,
ADD COLUMN     "totalSeasons" INTEGER;

-- AlterTable
ALTER TABLE "public"."torrent_search_results" ALTER COLUMN "link" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."tv_show_seasons" (
    "id" TEXT NOT NULL,
    "requestedTorrentId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "totalEpisodes" INTEGER,
    "status" "public"."SeasonStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tv_show_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tv_show_episodes" (
    "id" TEXT NOT NULL,
    "tvShowSeasonId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT,
    "airDate" TIMESTAMP(3),
    "status" "public"."EpisodeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tv_show_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."torrent_downloads" (
    "id" TEXT NOT NULL,
    "requestedTorrentId" TEXT NOT NULL,
    "tvShowSeasonId" TEXT,
    "tvShowEpisodeId" TEXT,
    "torrentTitle" TEXT NOT NULL,
    "torrentLink" TEXT,
    "magnetUri" TEXT,
    "torrentSize" TEXT,
    "seeders" INTEGER,
    "indexer" TEXT,
    "downloadJobId" TEXT,
    "aria2Gid" TEXT,
    "downloadProgress" DOUBLE PRECISION,
    "downloadSpeed" TEXT,
    "downloadEta" TEXT,
    "status" "public"."TorrentDownloadStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "torrent_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tv_show_seasons_requestedTorrentId_seasonNumber_key" ON "public"."tv_show_seasons"("requestedTorrentId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tv_show_episodes_tvShowSeasonId_episodeNumber_key" ON "public"."tv_show_episodes"("tvShowSeasonId", "episodeNumber");

-- AddForeignKey
ALTER TABLE "public"."tv_show_seasons" ADD CONSTRAINT "tv_show_seasons_requestedTorrentId_fkey" FOREIGN KEY ("requestedTorrentId") REFERENCES "public"."requested_torrents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tv_show_episodes" ADD CONSTRAINT "tv_show_episodes_tvShowSeasonId_fkey" FOREIGN KEY ("tvShowSeasonId") REFERENCES "public"."tv_show_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."torrent_downloads" ADD CONSTRAINT "torrent_downloads_requestedTorrentId_fkey" FOREIGN KEY ("requestedTorrentId") REFERENCES "public"."requested_torrents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."torrent_downloads" ADD CONSTRAINT "torrent_downloads_tvShowSeasonId_fkey" FOREIGN KEY ("tvShowSeasonId") REFERENCES "public"."tv_show_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."torrent_downloads" ADD CONSTRAINT "torrent_downloads_tvShowEpisodeId_fkey" FOREIGN KEY ("tvShowEpisodeId") REFERENCES "public"."tv_show_episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
