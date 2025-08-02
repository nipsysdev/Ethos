# Ethos

Tracking digital freedom threats through automated crawling. Part of the [Logos](https://logos.co) ecosystem.

## What is Ethos?

Ethos crawls websites from digital rights organizations to track threats to online freedom. We're building YAML-driven web scrapers that automatically collect data about censorship, surveillance, and policy changes - then store it in a decentralized network for analysis and alerts.

## End-Goal Architecture Overview

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

- **Library**: Core crawling, storage, and analysis logic
- **Nodes**: Run continuous operations using the library
- **Client Apps**: Discord bots, research UIs that request data via Waku

## Development Phases

### Phase 1: Listing crawler ✓

### Phase 2: Simulating decentralized Storage (current)

### Phase 3: Data analysis strategies

### Phase 4: Feature-complete CLI interface

### TBD...

## Components

### [@ethos/lib](./packages/lib/)

The core TypeScript library containing all the logic for crawling, storage access, and running analysis strategies.

This library is intended to be used by network nodes to perform all operations.

It also features a CLI for testing purposes.

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

## Pipeline

```
Sources → Crawl → Store → Processing (Query/Analyze/Notify/Display)
```

## Quick Start

1. **Install dependencies**:

   ```bash
   git clone https://github.com/logos-co/ethos.git
   cd ethos

   # Install Node.js 22+ (using asdf or manually)
   asdf install  # or ensure Node.js 22+
   pnpm install
   ```

2. **Try the library through the CLI**:

   ```bash
   cd packages/lib
   pnpm run build
   node dist/cli/index.js
   ```

## Development

This is a monorepo using Lerna and PNPM:

```bash
pnpm run build    # Build all packages
pnpm run lint     # Lint all packages
pnpm run test     # Test all packages
pnpm run watch    # Watch mode for development
```

The system uses local simulation during development with SQLite and JSON files that mirror the production architecture (Smart Contract + Codex).

## Contributing

Please read our [Contributing Guidelines](./CONTRIBUTING.md) to get started.

### Code of Conduct

This project follows our [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it to understand the expectations for participation in our community.

## License

Apache License 2.0
