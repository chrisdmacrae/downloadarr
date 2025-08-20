/*
  Warnings:

  - You are about to drop the column `downloadEta` on the `requested_torrents` table. All the data in the column will be lost.
  - You are about to drop the column `downloadProgress` on the `requested_torrents` table. All the data in the column will be lost.
  - You are about to drop the column `downloadSpeed` on the `requested_torrents` table. All the data in the column will be lost.
  - You are about to drop the column `downloadEta` on the `torrent_downloads` table. All the data in the column will be lost.
  - You are about to drop the column `downloadProgress` on the `torrent_downloads` table. All the data in the column will be lost.
  - You are about to drop the column `downloadSpeed` on the `torrent_downloads` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."requested_torrents" DROP COLUMN "downloadEta",
DROP COLUMN "downloadProgress",
DROP COLUMN "downloadSpeed";

-- AlterTable
ALTER TABLE "public"."torrent_downloads" DROP COLUMN "downloadEta",
DROP COLUMN "downloadProgress",
DROP COLUMN "downloadSpeed";

-- CreateTable
CREATE TABLE "public"."organization_rules" (
    "id" TEXT NOT NULL,
    "contentType" "public"."ContentType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "folderNamePattern" TEXT NOT NULL,
    "fileNamePattern" TEXT NOT NULL,
    "seasonFolderPattern" TEXT,
    "basePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organization_settings" (
    "id" TEXT NOT NULL,
    "libraryPath" TEXT NOT NULL DEFAULT '/library',
    "moviesPath" TEXT,
    "tvShowsPath" TEXT,
    "gamesPath" TEXT,
    "organizeOnComplete" BOOLEAN NOT NULL DEFAULT true,
    "replaceExistingFiles" BOOLEAN NOT NULL DEFAULT true,
    "extractArchives" BOOLEAN NOT NULL DEFAULT true,
    "deleteAfterExtraction" BOOLEAN NOT NULL DEFAULT true,
    "enableReverseIndexing" BOOLEAN NOT NULL DEFAULT true,
    "reverseIndexingCron" TEXT NOT NULL DEFAULT '0 * * * *',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organized_files" (
    "id" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "organizedPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" BIGINT,
    "contentType" "public"."ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "season" INTEGER,
    "episode" INTEGER,
    "platform" TEXT,
    "quality" TEXT,
    "format" TEXT,
    "edition" TEXT,
    "organizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReverseIndexed" BOOLEAN NOT NULL DEFAULT false,
    "requestedTorrentId" TEXT,

    CONSTRAINT "organized_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_rules_contentType_isDefault_key" ON "public"."organization_rules"("contentType", "isDefault");

-- AddForeignKey
ALTER TABLE "public"."organized_files" ADD CONSTRAINT "organized_files_requestedTorrentId_fkey" FOREIGN KEY ("requestedTorrentId") REFERENCES "public"."requested_torrents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
