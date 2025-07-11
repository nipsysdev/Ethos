# Ethos

Decentralized data collection system for digital rights monitoring. Part of the Logos (logos.co) ecosystem.

## Overview

Ethos automatically crawls and analyzes content from digital rights organizations, news sites, and advocacy groups to provide real-time intelligence on digital freedom issues. The system uses Waku for decentralized messaging and Codex for distributed storage.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Library       │    │   Node          │    │   Notifier      │
│   (Core Logic)  │────│   (Waku/Codex)  │────│   (Discord/etc) │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **Library**: Config-driven crawling and analysis engine
- **Node**: Distributed processing with Waku messaging and Codex storage
- **Notifier**: Real-time alerts and notifications

## Components

### [@ethos/lib](./packages/lib/)

Core crawling and analysis library. Provides the foundation for all data collection operations.

See the [library README](./packages/lib/README.md) for detailed documentation, API reference, and usage examples.

### [@ethos/node](./packages/node/) _(Coming Soon)_

Node software that uses the library for distributed processing with Waku messaging and Codex storage.

### [@ethos/notifier](./packages/notifier/) _(Coming Soon)_

Notification system that receives processed data and sends alerts via Discord and other channels.

## Monitored Sources

The system tracks 15+ digital rights organizations including advocacy groups (EFF, Privacy International), research organizations (Citizen Lab, Freedom House), legal resources (Court Listener, Lumen Database), news sources (TorrentFreak, Declassified UK), and crisis monitoring services (NetBlocks, Crisis Group).

See the [library documentation](./packages/lib/README.md) for the complete list and configuration details.

## Quick Start

1. **Install dependencies**:

   ```bash
   git clone https://github.com/logos-co/ethos.git
   cd ethos

   # If using asdf, install the correct Node.js version
   asdf install

   # Or manually ensure you have Node.js 22+
   pnpm install
   ```

2. **Try the library**:

   ```bash
   cd packages/lib
   pnpm run build
   node dist/cli/index.js
   ```

3. **See component READMEs** for detailed setup and usage instructions.

## Development

This is a monorepo using Lerna and PNPM. Common commands:

```bash
pnpm run watch    # Watch all packages
pnpm run build    # Build all packages
pnpm run lint     # Lint all packages
pnpm run format   # Format all packages
```

See the [library documentation](./packages/lib/README.md) for development workflow and setup details.

## Documentation

- [Library Package](./packages/lib/README.md) - Core crawling and analysis engine with full API documentation

## Contributing

1. **Adding Sources**: Edit YAML configs in the library package
2. **Analysis Strategies**: Write TypeScript modules for data processing
3. **Infrastructure**: Help with Waku/Codex integration and deployment

See component READMEs for specific contribution guidelines.

## License

Apache License 2.0
