-- AlterEnum
ALTER TYPE "public"."RequestStatus" ADD VALUE 'ORGANIZE_FAILED';

-- AlterTable
ALTER TABLE "public"."requested_torrents" ADD COLUMN     "organizeError" TEXT,
ADD COLUMN     "unorganizedFiles" TEXT[] DEFAULT ARRAY[]::TEXT[];
