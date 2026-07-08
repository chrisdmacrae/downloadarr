-- CreateEnum
CREATE TYPE "public"."TorrentLanguage" AS ENUM ('ENGLISH', 'FRENCH', 'GERMAN', 'SPANISH', 'ITALIAN', 'JAPANESE', 'KOREAN', 'CHINESE', 'HINDI', 'PORTUGUESE', 'RUSSIAN', 'DUTCH', 'MULTI');

-- AlterTable
ALTER TABLE "public"."requested_torrents" ADD COLUMN "preferredLanguages" "public"."TorrentLanguage"[];

-- AlterTable
ALTER TABLE "public"."torrent_search_results" ADD COLUMN "language" TEXT;
