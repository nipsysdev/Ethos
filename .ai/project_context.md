# Project Context

## Overview

Ethos is a decentralized digital rights data collection system. Four-phase pipeline: crawling → storage → CLI → analysis.

**Development phases tackle each part of the pipeline separately:**

- Phase 1: Crawling (current)
- Phase 2: Simulated Storage (SQLite + JSON files)
- Phase 3: CLI Interface (comprehensive command-line interface)
- Phase 4: Analysis
- Future: Decentralized storage (not planned yet)

## Current Phase: Phase 1 - Robust Crawler Foundation

Building production-ready YAML-driven crawlers for "listing" type sources. **Phase 1 focuses solely on the crawling part of the pipeline.**

**Key Architecture Decisions:**

- YAML schema for listing crawlers (paginated item lists → detail pages)
- Strict error handling: required fields abort page, optional fields continue
- Current schema expects detail page configuration
- Runtime args separate from YAML config

**Reference Implementation:** EFF updates page (https://www.eff.org/updates)

## Tech Stack

TypeScript, Puppeteer, Commander.js, SQLite → Smart Contract, JSON → Codex

## Components

- **Library**: TypeScript library containing ALL core logic (crawling, storage access, analysis)
- **Node**: Uses library for continuous operations + Waku communication with clients
- **Notifier**: Client apps (Discord bots, research UIs) that request services from nodes via Waku

**Architecture flow:** Client Apps ↔ Waku ↔ Network Nodes ↔ Library (core logic)
