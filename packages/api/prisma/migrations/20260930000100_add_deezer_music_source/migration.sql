-- AlterEnum
ALTER TYPE "public"."MusicSourceProvider" ADD VALUE 'DEEZER';

-- AlterEnum
ALTER TYPE "public"."MusicRecommendationList" ADD VALUE 'FLOW';
ALTER TYPE "public"."MusicRecommendationList" ADD VALUE 'SAVED_ALBUMS';

-- AlterTable
ALTER TABLE "public"."music_sources" ADD COLUMN     "displayName" TEXT;
