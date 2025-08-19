-- CreateTable
CREATE TABLE "public"."torrent_search_results" (
    "id" TEXT NOT NULL,
    "requestedTorrentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "magnetUri" TEXT,
    "size" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "seeders" INTEGER NOT NULL,
    "leechers" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "indexer" TEXT NOT NULL,
    "publishDate" TEXT NOT NULL,
    "quality" TEXT,
    "format" TEXT,
    "rankingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isAutoSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torrent_search_results_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."torrent_search_results" ADD CONSTRAINT "torrent_search_results_requestedTorrentId_fkey" FOREIGN KEY ("requestedTorrentId") REFERENCES "public"."requested_torrents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
