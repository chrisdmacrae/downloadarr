-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('MOVIE', 'TV_SHOW');

-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'SEARCHING', 'FOUND', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."TorrentQuality" AS ENUM ('SD', 'HD_720P', 'HD_1080P', 'UHD_4K', 'UHD_8K');

-- CreateEnum
CREATE TYPE "public"."TorrentFormat" AS ENUM ('X264', 'X265', 'XVID', 'DIVX', 'AV1', 'HEVC');

-- CreateTable
CREATE TABLE "public"."requested_torrents" (
    "id" TEXT NOT NULL,
    "contentType" "public"."ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "imdbId" TEXT,
    "tmdbId" INTEGER,
    "season" INTEGER,
    "episode" INTEGER,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "preferredQualities" "public"."TorrentQuality"[],
    "preferredFormats" "public"."TorrentFormat"[],
    "minSeeders" INTEGER NOT NULL DEFAULT 5,
    "maxSizeGB" INTEGER NOT NULL DEFAULT 20,
    "blacklistedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trustedIndexers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "searchAttempts" INTEGER NOT NULL DEFAULT 0,
    "maxSearchAttempts" INTEGER NOT NULL DEFAULT 50,
    "lastSearchAt" TIMESTAMP(3),
    "nextSearchAt" TIMESTAMP(3),
    "searchIntervalMins" INTEGER NOT NULL DEFAULT 30,
    "foundTorrentTitle" TEXT,
    "foundTorrentLink" TEXT,
    "foundMagnetUri" TEXT,
    "foundTorrentSize" TEXT,
    "foundSeeders" INTEGER,
    "foundIndexer" TEXT,
    "downloadJobId" TEXT,
    "aria2Gid" TEXT,
    "downloadProgress" DOUBLE PRECISION,
    "downloadSpeed" TEXT,
    "downloadEta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "requested_torrents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."torrent_search_logs" (
    "id" TEXT NOT NULL,
    "requestedTorrentId" TEXT NOT NULL,
    "searchQuery" TEXT NOT NULL,
    "indexersSearched" TEXT[],
    "resultsFound" INTEGER NOT NULL,
    "bestResultTitle" TEXT,
    "bestResultSeeders" INTEGER,
    "searchDurationMs" INTEGER NOT NULL,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torrent_search_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."torrent_search_logs" ADD CONSTRAINT "torrent_search_logs_requestedTorrentId_fkey" FOREIGN KEY ("requestedTorrentId") REFERENCES "public"."requested_torrents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
