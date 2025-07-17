# Ethos

Decentralized data collection system for digital rights monitoring. Part of the Logos (logos.co) ecosystem.

## Overview

Ethos provides a three-phase pipeline for digital rights data collection:

1. **Crawling** - Automated data extraction from configured sources
2. **Storage** - Deduplication and structured storage with content addressing
3. **Analysis** - On-demand processing for notifications and research

The system uses a hybrid architecture with smart contract coordination and decentralized content storage, designed to enable real-time monitoring and historical research of digital rights issues.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Library       │    │   Node          │    │   Notifier      │
│ (Crawl/Storage) │────│ (Waku/Codex)    │────│ (Alerts/Query)  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Storage Architecture

- **Smart Contract (Sepolia)**: Metadata coordination and deduplication
- **Codex**: Decentralized content storage using content addressing
- **Local Indexing**: Fast query layer for research and notifications

**Development Mode**: SQLite + JSON files simulate the production architecture

## Components

### [@ethos/lib](./packages/lib/)

Core library providing crawling, storage, and analysis capabilities. Features:

- Config-driven source management
- Pluggable crawler implementations
- Hybrid storage with deduplication
- On-demand analysis strategies

See the [library README](./packages/lib/README.md) for detailed documentation.

### [@ethos/node](./packages/node/) _(Coming Soon)_

Node software for decentralized operation:

- Waku messaging integration
- Codex storage coordination
- Smart contract interactions
- Network participation

### [@ethos/notifier](./packages/notifier/) _(Coming Soon)_

Notification and research system:

- Real-time alerts for critical events
- Historical data query interface
- Pattern analysis and trend detection
- Multi-channel notifications (Discord, etc.)

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

## Monitored Sources

The system is designed to track digital rights organizations including:

- **Advocacy**: EFF, Privacy International, Access Now
- **Research**: Citizen Lab, Freedom House, Internet Society
- **Legal**: Court Listener, Lumen Database, ACLU
- **News**: TorrentFreak, Declassified UK, Motherboard
- **Crisis**: NetBlocks, Crisis Group, Global Voices

See the [library documentation](./packages/lib/README.md) for configuration details.

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

## Use Cases

### Research Queries

```bash
ethos query --source eff --since "2024-01-01" --analyze sentiment
```

### Real-time Monitoring

```bash
ethos monitor --strategies urgency-detector --threshold 0.8
```

### Batch Analysis

```bash
ethos analyze --timerange "last-month" --strategies trend-analyzer
```

## Documentation

- [Library Package](./packages/lib/README.md) - Core functionality and API
- [Storage Architecture](./.ai/storage_architecture.md) - Detailed storage design
- [Analysis Framework](./.ai/analysis_framework.md) - On-demand processing
- [Codex Integration](./.ai/codex_integration.md) - Decentralized storage

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](./CONTRIBUTING.md) to get started.

Areas where you can help:

1. **Sources**: Add new data sources via YAML configuration
2. **Strategies**: Implement analysis strategies in TypeScript
3. **Storage**: Improve deduplication and query performance
4. **Infrastructure**: Help with Waku/Codex integration

See component READMEs for detailed contribution guidelines.

### Code of Conduct

This project follows our [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it to understand the expectations for participation in our community.

## License

Apache License 2.0
