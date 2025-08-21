# Reverse Indexing

When reverse indexing is enabled, a cron job runs every hour to check the library directories for new files. If a file is found that isn't already in the database, it will be added with the appropriate metadata.

## Problem

Right now it does not fetch game / movie / tv metadata and creates a request that is not managable because it's missing this data.

It also should _always_ index tv shows as ongoing requests and populate the season and episode completion data.

A sidebar: the season completion logic when a download completes treats episode downloads as a complete season, this needs to be fixed.

## The Scope

When a scan is ran, we should look for _folders_ in the library directories for movies, tv shows, and games (not the root library directory). If a folder is found that isn't already in the database, it will be added with the appropriate metadata if possible.

If a folder is found that is already in the database, it should be skipped.

If a folder is found that is not in the database and does not match the naming convention, it should be skipped.

If a folder is found that is not in the database and does match the naming convention, it should be added to a "organize queue" that can be manually processed. The queue exists in postgres.

Managing the queue involves doing a search for a piece of media and selecting it. You can search movies, tv shows, or games, pick one, and then the app will:

- Fetch metadata for the selected piece of media by tmdb id or igdb id
- Find a relevant organization rule for the content type
- Move the folder to the correct location based on the rule
- Rename the folder based on the rule
- Create a request in the database for the content