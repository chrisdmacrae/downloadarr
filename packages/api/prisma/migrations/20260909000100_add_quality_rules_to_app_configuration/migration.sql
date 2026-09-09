-- AlterTable
ALTER TABLE "public"."app_configuration" ADD COLUMN     "autoSelectBest" BOOLEAN,
ADD COLUMN     "blacklistedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "defaultFormats" "public"."TorrentFormat"[],
ADD COLUMN     "defaultLanguages" "public"."TorrentLanguage"[],
ADD COLUMN     "defaultQualities" "public"."TorrentQuality"[],
ADD COLUMN     "maxSizeGB" INTEGER,
ADD COLUMN     "minSeeders" INTEGER,
ADD COLUMN     "preferRemux" BOOLEAN,
ADD COLUMN     "preferSmallSize" BOOLEAN,
ADD COLUMN     "trustedIndexers" TEXT[] DEFAULT ARRAY[]::TEXT[];
