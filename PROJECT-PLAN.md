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

## Phase 4: Torrent Integration
- [ ] Jackett API service integration
- [ ] Torrent search and filtering logic
- [ ] Movie/TV torrent discovery endpoints
- [ ] Quality and format filtering

## Phase 5: ROM Management System
- [ ] SQLite database schema for ROM sources
- [ ] ROM scraping service (dedicated Docker container)
- [ ] YAML configuration system for sources
- [ ] Cron job scheduler for periodic scraping
- [ ] Initial Myrient.erista.me scraper implementation
- [ ] ROM database API endpoints

## Phase 6: Frontend Development
- [ ] React UI with shadcn/ui components
- [ ] Search interfaces:
  - [ ] Movie discovery
  - [ ] TV show discovery
  - [ ] ROM discovery
- [ ] Download management dashboard
- [ ] Job queue monitoring interface
- [ ] Settings and configuration pages

## Phase 7: Integration & Queue Management
- [ ] Download job creation from discovery results
- [ ] Queue prioritization and management
- [ ] Failed job retry logic
- [ ] Download completion notifications

## Phase 8: Deployment & Testing
- [ ] Complete Docker Compose orchestration
- [ ] Container networking and volume management
- [ ] Integration testing across all services
- [ ] API documentation
- [ ] Production deployment guide