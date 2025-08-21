-- AlterTable
ALTER TABLE "app_configuration" ADD COLUMN     "igdbClientId" TEXT,
ADD COLUMN     "igdbClientSecret" TEXT,
ADD COLUMN     "omdbApiKey" TEXT,
ADD COLUMN     "tmdbApiKey" TEXT;
