-- CreateEnum
CREATE TYPE "public"."DownloadType" AS ENUM ('MAGNET', 'TORRENT', 'HTTP', 'HTTPS');

-- CreateEnum
CREATE TYPE "public"."MediaType" AS ENUM ('MOVIE', 'TV', 'GAME');

-- CreateEnum
CREATE TYPE "public"."DownloadStatus" AS ENUM ('ACTIVE', 'WAITING', 'PAUSED', 'ERROR', 'COMPLETE', 'REMOVED');

-- CreateTable
CREATE TABLE "public"."download_metadata" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "type" "public"."DownloadType" NOT NULL,
    "mediaType" "public"."MediaType",
    "mediaTitle" TEXT,
    "mediaYear" INTEGER,
    "mediaPoster" TEXT,
    "mediaOverview" TEXT,
    "aria2Gid" TEXT NOT NULL,
    "aria2ChildGids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "public"."DownloadStatus" NOT NULL DEFAULT 'ACTIVE',
    "destination" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "download_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "download_metadata_aria2Gid_key" ON "public"."download_metadata"("aria2Gid");
