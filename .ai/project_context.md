# Project Context

## Overview

Ethos is a decentralized data collection system for digital rights monitoring. It uses a three-phase pipeline: crawling, structured storage with deduplication, and on-demand analysis.

## Components

- **Library**: Core crawling/analysis logic with CLI and storage layer
- **Node**: Uses library + Waku/Codex integration for decentralized operation
- **Notifier**: Alert system for critical events and research notifications

## Tech Stack

TypeScript, Puppeteer, Commander.js, SQLite, Waku, Codex, Solidity

## Architecture

Three-phase pipeline with hybrid storage:

- **Crawling**: Config-driven with pluggable strategies
- **Storage**: Smart contract coordination + decentralized content storage
- **Analysis**: On-demand processing for queries and notifications

The system is designed for eventual migration from local development (SQLite + JSON) to decentralized production (Sepolia + Codex).

## Development Phases

### Phase 0: Project Setup & Documentation

- GitHub project setup and workflows
- Issue templates and contributor guidelines
- Documentation foundation (AI knowledge base + human docs)
- Developer tooling (linting, hooks, CI)

### Phase 1: Robust Crawler Foundation

- Production-ready ArticleListingCrawler
- Real source implementation (starting with EFF)
- Error handling, retries, and rate limiting
- Comprehensive logging and monitoring

### Phase 2: Storage Layer Implementation

- LocalMetadataStore (SQLite) for fast queries
- LocalContentStore (JSON) for content-addressed storage
- Deduplication logic and status tracking
- Query interfaces and basic search

### Phase 3: CLI Interface

- Core commands (crawl, query, status, monitor)
- Interactive features and progress indicators
- Export capabilities and configuration management
- Batch processing support

### Phase 4: Analysis Framework

- Pluggable analysis strategy system
- Core strategies (keyword extraction, classification, urgency detection)
- Confidence scoring and metadata enrichment
- Strategy registration and batch analysis
