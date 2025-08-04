# Project Context

## Status

- **Phase 1**: Crawling ✅ COMPLETE
- **Phase 2**: Storage (SQLite + JSON) - CURRENT
- **Phase 3**: CLI expansion
- **Phase 4**: Analysis

## Architecture

Ethos: decentralized digital rights data collection. Pipeline: crawl → store → analyze → notify.

**Components:**

- `packages/lib/`: Core TypeScript library (ALL logic)
- `packages/node/`: Network service (future)
- `packages/notifier/`: Client apps (future)

## Phase 1 Complete

- ArticleListingCrawler with pagination + optional detail pages
- Interactive CLI (`pnpm cli`)
- YAML-driven configs, error handling, deduplication
- EFF reference implementation working

## Tech Stack

TypeScript, Puppeteer, pnpm workspace, Vite, Biome
