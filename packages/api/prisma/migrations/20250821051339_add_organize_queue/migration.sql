-- CreateEnum
CREATE TYPE "public"."OrganizeQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "public"."organize_queue" (
    "id" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "contentType" "public"."ContentType" NOT NULL,
    "detectedTitle" TEXT,
    "detectedYear" INTEGER,
    "detectedSeason" INTEGER,
    "detectedEpisode" INTEGER,
    "detectedPlatform" TEXT,
    "detectedQuality" TEXT,
    "detectedFormat" TEXT,
    "detectedEdition" TEXT,
    "status" "public"."OrganizeQueueStatus" NOT NULL DEFAULT 'PENDING',
    "selectedTmdbId" TEXT,
    "selectedIgdbId" TEXT,
    "selectedTitle" TEXT,
    "selectedYear" INTEGER,
    "selectedPlatform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "organize_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organize_queue_folderPath_key" ON "public"."organize_queue"("folderPath");
