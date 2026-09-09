-- Downloadarr now indexes through Prowlarr instead of Jackett. The columns are
-- renamed rather than dropped so nothing else in the row is disturbed, but the
-- values themselves do not carry over: a Jackett API key does not authenticate
-- against Prowlarr, and the old default pointed at the Jackett container.
ALTER TABLE "public"."app_configuration" RENAME COLUMN "jackettApiKey" TO "prowlarrApiKey";
ALTER TABLE "public"."app_configuration" RENAME COLUMN "jackettUrl" TO "prowlarrUrl";

ALTER TABLE "public"."app_configuration" ALTER COLUMN "prowlarrUrl" SET DEFAULT 'http://prowlarr:9696';

UPDATE "public"."app_configuration"
SET "prowlarrUrl" = 'http://prowlarr:9696'
WHERE "prowlarrUrl" IS NULL OR "prowlarrUrl" LIKE '%jackett%' OR "prowlarrUrl" LIKE '%:9117%';

-- Force a re-entry of the key: leaving the Jackett one in place would look
-- configured while every search failed with a 401.
UPDATE "public"."app_configuration" SET "prowlarrApiKey" = NULL;
