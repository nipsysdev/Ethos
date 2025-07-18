# Ethos

Decentralized data collection system for digital rights monitoring. Part of the Logos ecosystem.

## What is Ethos?

Ethos is a decentralized system to collect and analyze digital rights data from across the web. Think of it as a distributed monitoring and data collection network for digital rights issues - tracking censorship, surveillance, policy changes, and advocacy efforts from organizations worldwide.

## The Vision

Digital rights advocacy happens in silos. Organizations like EFF, Privacy International, and AccessNow all publish important updates, but there's no unified way to monitor, analyze, and access this information.

## Current Status

We implemented a proof of concept and are now working on the actual crawling foundation - building production-ready YAML-driven crawlers that can reliably extract data from digital rights organizations' websites.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TypeScript    │    │   Network       │    │   Client Apps   │
│    Library      │    │    Nodes        │    │  (Discord Bot,  │
│ (Core Logic for │────│ (Continuous     │────│   Research UI,  │
│  Crawl/Storage/ │    │  Operations +   │    │   Alerting)     │
│   Analysis)     │    │  Waku Comms)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**How it works:**

- **Library**: Contains all core logic for crawling, storage access, and analysis
- **Nodes**: Use the library to run continuous crawling/storage + on-demand analysis
- **Communication**: Nodes receive requests through Waku from client applications
- **Client Apps**: Discord notifiers, research interfaces, etc. talk to nodes via Waku

## Development Phases

### Phase 1: Robust Crawler Foundation (Current)

Building production-ready crawlers for "listing" type sources with strict error handling.

**Key Features:**

- YAML-driven crawler configuration
- Support for listing sources (paginated item lists)
- Current schema expects detail page configuration
- Runtime parameters separate from config
- Comprehensive error handling

**Target Sources:**

- EFF Updates (reference implementation)
- AccessNow
- TorrentFreak
- Big Brother Watch
- Citizenlab
- Declassified UK
- Freedom Press

### Phase 2: Simulated Storage (Next)

Implementing the storage layer with deduplication using SQLite and JSON files.

**Planned Features:**

- SQLite database for metadata and deduplication
- JSON files for content storage
- Content-addressed deduplication
- Fast query interfaces for research

### Phase 3: CLI Interface (Future)

Creating a comprehensive command-line interface for the system.

**Planned Features:**

- User-friendly commands for crawling and querying
- Interactive configuration management
- Batch processing capabilities
- Export and reporting tools

### Phase 4: Analysis (Future)

On-demand analysis system with pluggable strategies.

**Planned Features:**

- Keyword extraction and classification
- Sentiment analysis and urgency detection
- Data APIs for consuming projects
- Historical trend analysis

## Components

### [@ethos/lib](./packages/lib/)

The core TypeScript library containing all the logic for crawling, storage access, and analysis. Features:

- Config-driven source management
- Pluggable crawler implementations
- Hybrid storage with deduplication
- On-demand analysis strategies

This library is used by network nodes to perform all operations.

See the [library README](./packages/lib/README.md) for detailed documentation.

### [@ethos/node](./packages/node/) _(To be implemented)_

Network nodes that use the library for continuous operations:

- Continuous crawling and storage using the library
- On-demand and daemonized analysis algorithms
- Waku messaging for client communication
- Codex storage coordination

### [@ethos/notifier](./packages/notifier/) _(To be implemented)_

Client application that communicates with nodes via Waku to query stored events and notify users:

- Query stored events from network nodes
- Send notifications through Discord, Telegram, and other channels
- Real-time alerts for critical events
- Multi-channel notification support

## Data Flow

```
Sources → Crawl → Deduplicate → Store → Query/Analyze → Notify
```

1. **Crawl**: Extract content from configured sources
2. **Deduplicate**: Check smart contract for existing content
3. **Store**: Save to Codex with metadata coordination
4. **Query**: Research interface for historical data
5. **Analyze**: On-demand processing with pluggable strategies
6. **Notify**: Alerts for critical events and patterns

## Quick Start

1. **Install dependencies**:

   ```bash
   git clone https://github.com/logos-co/ethos.git
   cd ethos

   # Install Node.js 22+ (using asdf or manually)
   asdf install  # or ensure Node.js 22+
   pnpm install
   ```

2. **Try the library**:

   ```bash
   cd packages/lib
   pnpm run build
   node dist/cli/index.js crawl --source eff
   ```

3. **Check stored data**:

   ```bash
   # View metadata
   sqlite3 ~/.ethos/metadata.db "SELECT * FROM events;"

   # View content
   ls ~/.ethos/content/
   ```

## Development

This is a monorepo using Lerna and PNPM:

```bash
pnpm run build    # Build all packages
pnpm run lint     # Lint all packages
pnpm run test     # Test all packages
pnpm run watch    # Watch mode for development
```

The system uses local simulation during development with SQLite and JSON files that mirror the production architecture (Sepolia + Codex).

## Contributing

Please read our [Contributing Guidelines](./CONTRIBUTING.md) to get started.

### Code of Conduct

This project follows our [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it to understand the expectations for participation in our community.

## License

Apache License 2.0
