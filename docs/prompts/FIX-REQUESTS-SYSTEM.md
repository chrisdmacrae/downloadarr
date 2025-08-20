# Fix Requests System

The request system is a little janky.

There's too many places the lifecycle happens in and we miss spots.

# How It Should Work

1. When you place a request for:
    - A movie
        - Which is requested for a specific year
        - At a specific set of qualities
        - In a specific set of formats
    - A TV show
        - Which is requested for a specific set of seasons or a specific set of episodes, or;
        - Which is requested for all seasons and is ongoing
        - At a specific set of qualities
        - In a specific set of formats
    - A game
        - Which is requested for a specific set of platforms and/or a specific set of genres, or;
        - Which is requested for all platforms and/or all genres
2. The request is created in the database with a status of `PENDING`
3. The request is added to the queue to be searched
4. When the request is searched:
    - Either manually by a user through the torrent search, or;
    - Or automatically by the search queue, then;
    - The request status is updated to `FOUND`
5. When the user selects a torrent:
    - The request status is updated to `DOWNLOADING`
6. When the download is complete:
    - The request status is updated to `COMPLETED`
7. If the download fails:
    - The request status is updated to `FAILED`
8. If the user cancels the request:
    - The request status is updated to `CANCELLED`
9. If the request expires:
    - The request status is updated to `EXPIRED`

A request is expired if it has not been searched in `x` amount of time.

A request is cancelled if the user cancels it or the associated download. A cancelled request can be re-searched.

## TV Shows

When a TV show is requested, it can be requested in one of two ways:

1. A specific set of seasons or a specific set of episodes
2. All seasons and is ongoing

When a TV show is requested for a specific set of seasons or episodes, it is a one-time request. When it is completed, it is done.

When a TV show is requested for all seasons and is ongoing, it is an ongoing request. The request should automatically search for new episodes when they are added to the show.

The status of an ongoing request should be the status of the latest season that is not completed.

The status of a season should be the status of the latest episode that is not completed.

When a season pack is downloaded, all episodes are complete.

When an episode is downloaded, only that episode is complete.

## The Scope

Review all services that are involved in the lifcycle of a request and ensure they are all in sync with the above by introducing a state machine that controls the request lifecycle, and making a service that orchestrates the request lifecycle and all of the side effects.

For anywhere we send download status for a response to a request, we fetch the status from aria2 live. We do not store download state in the database.