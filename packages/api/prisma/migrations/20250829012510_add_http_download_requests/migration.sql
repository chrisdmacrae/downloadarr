/*
  Warnings:

  - You are about to drop the column `tvShowEpisodeId` on the `torrent_downloads` table. All the data in the column will be lost.
  - You are about to drop the column `tvShowSeasonId` on the `torrent_downloads` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."HttpDownloadRequestStatus" AS ENUM ('PENDING_METADATA', 'METADATA_MATCHED', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "public"."torrent_downloads" DROP CONSTRAINT "torrent_downloads_tvShowEpisodeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."torrent_downloads" DROP CONSTRAINT "torrent_downloads_tvShowSeasonId_fkey";

-- AlterTable
ALTER TABLE "public"."torrent_downloads" DROP COLUMN "tvShowEpisodeId",
DROP COLUMN "tvShowSeasonId";

-- CreateTable
CREATE TABLE "public"."http_download_requests" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" "public"."ContentType",
    "title" TEXT,
    "year" INTEGER,
    "imdbId" TEXT,
    "tmdbId" INTEGER,
    "igdbId" INTEGER,
    "platform" TEXT,
    "genre" TEXT,
    "season" INTEGER,
    "episode" INTEGER,
    "status" "public"."HttpDownloadRequestStatus" NOT NULL DEFAULT 'PENDING_METADATA',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "destination" TEXT,
    "downloadJobId" TEXT,
    "aria2Gid" TEXT,
    "fileSize" TEXT,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadataMatchedAt" TIMESTAMP(3),
    "downloadStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "http_download_requests_pkey" PRIMARY KEY ("id")
);
