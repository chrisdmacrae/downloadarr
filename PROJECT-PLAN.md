# Project Plan

## Overview
All-in-one media and ROM downloading tool with VPN integration, NestJS API with BullMQ job processing, deployed via Docker Compose.

## Phase 1: Project Setup & Core Infrastructure
- [ ] Initialize monorepo with `packages/` structure
- [ ] Setup private NPM packages:
  - [ ] `@app/api` - NestJS REST API server
  - [ ] `@app/ui` - React frontend with shadcn/ui
- [ ] NestJS project setup with BullMQ integration
- [ ] Docker Compose configuration (API, Frontend, Jackett)
- [ ] VPN integration with node-openvpn

## Phase 2: Download Engine & Queue System
- [ ] BullMQ setup for download job processing
- [ ] Aria2c service integration via aria2.js
- [ ] Download job workers for:
  - [ ] Magnet links
  - [ ] Torrent files
  - [ ] HTTP/HTTPS downloads
- [ ] Job queue management and monitoring
- [ ] Progress tracking and status updates

## Phase 3: Discovery Services
- [ ] NestJS services for external APIs:
  - [ ] OMDB service for movies
  - [ ] TMDB service for TV shows (note: spec mentions TMDB but links to OMDB)
  - [ ] IGDB service for ROMs
- [ ] REST API controllers for each service
- [ ] Error handling and rate limiting
- [ ] Basic search UI with images

## Phase 4: Torrent Integration ✅
- [x] Jackett API service integration
- [x] Torrent search and filtering logic
- [x] Movie/TV torrent discovery endpoints
- [x] Quality and format filtering

## Phase 5: ROM Management System
- [ ] SQLite database schema for ROM sources
- [ ] ROM scraping service (dedicated Docker container)
- [ ] YAML configuration system for sources
- [ ] Cron job scheduler for periodic scraping
- [ ] Initial Myrient.erista.me scraper implementation (utilize playwright MCP server in LLM to understand markup)
- [ ] ROM database API endpoints