-- AlterTable
ALTER TABLE "public"."requested_torrents" ADD COLUMN     "backdropUrl" TEXT,
ADD COLUMN     "posterUrl" TEXT;

-- AlterTable
ALTER TABLE "public"."http_download_requests" ADD COLUMN     "backdropUrl" TEXT,
ADD COLUMN     "posterUrl" TEXT;
