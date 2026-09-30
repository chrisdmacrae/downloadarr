-- AlterEnum
ALTER TYPE "public"."ContentType" ADD VALUE 'MUSIC';

-- AlterTable
ALTER TABLE "public"."requested_torrents" ADD COLUMN     "artist" TEXT,
ADD COLUMN     "musicbrainzId" TEXT;

-- AlterTable
ALTER TABLE "public"."organization_settings" ADD COLUMN     "musicPath" TEXT;
