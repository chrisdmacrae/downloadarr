-- AlterEnum
ALTER TYPE "public"."MusicSourceProvider" ADD VALUE 'SPOTIFY';

-- AlterTable
ALTER TABLE "public"."music_sources" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "redirectUri" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);
