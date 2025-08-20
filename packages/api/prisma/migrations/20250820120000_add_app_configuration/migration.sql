-- CreateTable
CREATE TABLE "public"."app_configuration" (
    "id" TEXT NOT NULL,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "jackettApiKey" TEXT,
    "jackettUrl" TEXT NOT NULL DEFAULT 'http://jackett:9117',
    "organizationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_configuration_pkey" PRIMARY KEY ("id")
);
