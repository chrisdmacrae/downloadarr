# Organization Rules

Files need to be moved to the correct location based on the content type and metadata.

Movies have a set of rules:

- Folder
  - Name: `{title} ({year})`
  - Example: `The Matrix (1999)`
- Files
  - Name: `{title} ({year}) - {edition} - {quality} - {format}`
  - Example: `The Matrix (1999) - 1080p BluRay - x265 - 10bit`

TV Shows have a set of rules:

- Folder
  - Name: `{title} ({year})`
  - Example: `Breaking Bad (2008)`
- Season Folder
  - Name: `Season {seasonNumber}`
  - Example: `Season 1`
- Files
  - Name: `{title} - S{seasonNumber}E{episodeNumber} - {edition} - {quality} - {format}`
  - Example: `Breaking Bad - S01E01 - 1080p BluRay - x265 - 10bit`

Games have a set of rules:

- Folder
  - Name: `{title} ({platform})`
  - Example: `Super Mario Bros. (NES)`
- Files
  - Name: `{title} ({platform}) - {edition}`
  - Example: `Super Mario Bros. (NES) - NTSC-U`

Rules are relative to the `LIBRARY_PATH` environment variable.
You can optionally set `MOVIES_PATH`, `TV_SHOWS_PATH`, and `GAMES_PATH` to override the default paths.

When a file finishes downloading, the organize rules are used to construct a move and rename of the downloaded files. This includes unzipped the download if it's a compressed file.

If the file already exists, it should be deleted and the new file should be moved in its place.

Organizer rules also allow "reverse-indexing" -- wherein a cron runs every hour to check the files in the library against the database. If a file is found that isn't already requested, it should be added to the database with the appropriate metadata.

Organnizer rules are stored in the database, have logical defaults, and can be configured by the user via the settings page.