# SPEC

This project is an all-in-one tool for:

- Downloading movies
- Downloading tv shows
- Downloading ROMs

# Requirements

- It will use a VPN using node-openvpn
- It will use aria2c for downloading via aria2.js
- It will be deployed via docker compose, which will run:
    - The api
    - The frontend
    - The jackett api
- The API will be powered by NestJS
- Downloads will work via the bullmq using the NestJS bullmq integration

# Features

## Discovery

## Movies

The UI for discovery of tv and movies will use the open movie database (omdb) https://www.omdbapi.com

A service will be created in the API for interacting with omdb, and the UI will interact with the API via REST.

## TV Shows

The UI for discovery of tv and movies will use the open movie database (tmdb) https://www.omdbapi.com

A service will be created in the API for interacting with tmdb, and the UI will interact with the API via REST.

## ROMs

ROM discovery will be done using the IGDB by Twitch (https://www.igdb.com).

A service will be created in the API for interacting with IGDB, and the UI will interact with the API via REST.

## Downloading

Downloading will be done using aria2c via aria2.js.

A download service will be created in the API for interacting with aria2c, and the UI will interact with the API via REST. You will be able to download via magnet links, torrent files, and http/https.

## Downloading movies & tv

Movies and TV will be done via torrents, with available torrents found using jackett (https://github.com/Jackett/Jackett).

A service will be created in the API for interacting with jackett, and the UI will interact with the API via REST.

## Downloading ROMs

ROMs will be done via http or torrents, depending on the source.

Sources will be indexed in a sqlite database, found by scraping the internet from available rom sources.

A service will be created in the API for interacting with the sqlite database, and the UI will interact with the API via REST.

The scraping will be ran as a cron job in a dedicated docker container, from a list of sources defined in a YAML file.

The first source will be https://myrient.erista.me/files/No-Intro/

# Project Organization

Create a packages folder.

Each module is a separate private NPM package.

- api: the web REST API
- ui: the web UI driven via react
    - it will use shacdn for clean UX