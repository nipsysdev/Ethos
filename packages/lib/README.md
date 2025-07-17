# @ethos/lib

Core library for the Ethos data collection system. Provides config-driven web crawling with structured storage and on-demand analysis for digital rights monitoring.

## Features

- **Config-driven sources**: Add new websites via YAML configuration
- **Structured storage**: Hybrid metadata + content storage with deduplication
- **On-demand analysis**: Process stored data with pluggable strategies
- **Multiple crawler types**: Article listings, RSS feeds, APIs, social media
- **CLI tools**: Interactive crawling, storage, and analysis management
- **TypeScript**: Full type safety and IntelliSense support

## Installation

```bash
pnpm add @ethos/lib
```

## Quick Start

### Using the CLI

```bash
# Build and run
pnpm run build
node dist/cli/index.js

# Crawl and store data
node dist/cli/index.js crawl --source eff

# Query stored data
node dist/cli/index.js query --source eff --since yesterday

# Check storage status
node dist/cli/index.js status
```

### Available Commands

- `crawl <source>` - Crawl and store data from a source
- `query [options]` - Query stored events with optional analysis
- `monitor [options]` - Monitor for critical events
- `status` - Show storage status and statistics
- `list` - List stored events
- `show <cid>` - Show content by CID

### Programmatic Usage

```typescript
import {
  SourceRegistry,
  CrawlerRegistry,
  StrategyRegistry,
  ProcessingPipeline,
  LocalMetadataStore,
  LocalContentStore,
} from "@ethos/lib";

// Initialize storage
const metadataStore = new LocalMetadataStore();
const contentStore = new LocalContentStore();

// Initialize registries
const sourceRegistry = new SourceRegistry("./config/sources.yaml");
const crawlerRegistry = new CrawlerRegistry();
const strategyRegistry = new StrategyRegistry();
const pipeline = new ProcessingPipeline(
  crawlerRegistry,
  strategyRegistry,
  metadataStore,
  contentStore
);

// Crawl and store
const source = await sourceRegistry.getSource("eff");
await pipeline.crawlAndStore(source);

// Query and analyze
const events = await metadataStore.getEvents({
  sourceId: "eff",
  since: Date.now() - 24 * 60 * 60 * 1000,
});

const results = await Promise.all(
  events.map(async (event) => {
    const content = await contentStore.retrieve(event.cid);
    return analyzeContent(content, ["digital-rights-classifier"]);
  })
);
```

## Storage Architecture

The library uses a hybrid storage approach:

- **Metadata Store**: SQLite database for fast queries and deduplication
- **Content Store**: Content-addressed JSON files for raw data
- **On-demand Analysis**: Strategies applied when querying, not during storage

### Storage Flow

```typescript
// 1. Crawl data
const crawledData = await crawler.crawl(source);

// 2. Check for duplicates
const contentHash = hashContent(crawledData);
if (await metadataStore.isDuplicate(contentHash)) {
  return; // Skip duplicate
}

// 3. Store with status tracking
await metadataStore.markUploading(contentHash, metadata);
const cid = await contentStore.store(crawledData);
await metadataStore.updateCID(contentHash, cid);
```

### Data Directory

```
~/.ethos/
├── metadata.db          # SQLite - events, status, CIDs
└── content/
    ├── bafybeig...abc123.json    # Raw crawled data
    ├── bafybeig...def456.json    # Content-addressed storage
    └── ...
```

## Configuration

### Adding Sources

Edit `src/config/sources.yaml`:

```yaml
sources:
  - id: "my-source"
    name: "My News Site"
    type: "article-listing"
    listing:
      url: "https://example.com/news"
      itemSelector: ".article"
    extraction:
      detail:
        url: "h2 a@href"
        title: "h1"
        content: ".content"
    processingStrategies:
      - "digital-rights-classifier"
```

### Creating Analysis Strategies

```typescript
import { ProcessingStrategy, CrawledData, AnalysisResult } from "@ethos/lib";

export class MyAnalyzer implements ProcessingStrategy {
  id = "my-analyzer";
  name = "My Custom Analyzer";

  async process(data: CrawledData): Promise<AnalysisResult> {
    // Your analysis logic here
    return {
      topics: ["example"],
      sentiment: 0.5,
      relevance: 0.8,
      keywords: ["keyword1", "keyword2"],
      confidence: 0.9,
      metadata: {},
    };
  }
}
```

## Usage Examples

### Query and Analysis

```bash
# Query recent events
ethos query --source eff --since "2024-01-01"

# Query with analysis
ethos query --analyze sentiment,keywords --output results.json

# Monitor for critical events
ethos monitor --strategies urgency-detector --threshold 0.8
```

### Batch Processing

```bash
# Crawl all sources
ethos crawl --all

# Analyze stored data with new strategies
ethos analyze --timerange "last-month" --strategies trend-analyzer

# Export data
ethos export csv --source eff --since "2024-01-01"
```

## Architecture

The library uses a storage-first architecture with on-demand analysis:

- **Sources**: YAML configs for non-technical users
- **Crawlers**: Reusable crawling patterns (article-listing, RSS, API, etc.)
- **Storage**: Hybrid metadata + content storage with deduplication
- **Strategies**: Code-based analysis modules (applied on-demand)
- **Registries**: Manage available crawlers and strategies
- **Pipeline**: Orchestrates crawling → storage → analysis

### Data Flow

```
Source Config → Crawler → Storage (with deduplication) → Query → Analysis
```

## Available Components

### Crawlers

- **ArticleListingCrawler**: Two-step crawling (listing → articles)

### Storage Providers

- **LocalMetadataStore**: SQLite-based metadata storage
- **LocalContentStore**: Content-addressed file storage

### Analysis Strategies

- **KeywordExtractor**: Finds digital rights keywords and topics
- **DigitalRightsClassifier**: Categorizes content by digital rights issues
- **UrgencyDetector**: Identifies critical/breaking content

## Development

```bash
pnpm install              # Install dependencies
pnpm run build           # Build the package
pnpm run watch           # Watch mode for development
pnpm test                # Run tests
```

Test the CLI:

```bash
pnpm run build
node dist/cli/index.js crawl --source eff
```

## Directory Structure

```
src/
├── core/                    # Core types and registries
│   ├── types.ts            # TypeScript interfaces
│   ├── SourceRegistry.ts   # YAML config loading
│   ├── CrawlerRegistry.ts  # Crawler management
│   ├── StrategyRegistry.ts # Strategy management
│   └── ProcessingPipeline.ts # Main orchestration
├── crawlers/               # Crawler implementations
│   ├── ArticleListingCrawler.ts
│   └── baseCrawler.ts     # Legacy simple crawler
├── storage/                # Storage implementations
│   ├── LocalMetadataStore.ts
│   ├── LocalContentStore.ts
│   └── interfaces.ts      # Storage interfaces
├── strategies/             # Analysis strategy implementations
│   └── implementations/
│       ├── KeywordExtractor.ts
│       ├── DigitalRightsClassifier.ts
│       └── UrgencyDetector.ts
├── config/                 # Configuration files
│   └── sources.yaml       # Source definitions
├── cli/                    # Command-line interface
│   └── index.ts
└── utils/                  # Utility functions
```

## Migration Path

The library is designed for seamless migration from development to production:

1. **Development**: Local SQLite + JSON files
2. **Production**: Sepolia smart contract + Codex storage
3. **Interfaces**: Identical storage interfaces for both modes

## Contributing

1. Add new sources by editing `src/config/sources.yaml`
2. Create new analysis strategies in `src/strategies/implementations/`
3. Implement new storage providers in `src/storage/`
4. Register new components in the appropriate registries
5. Follow the existing patterns and TypeScript conventions

## License

Apache License 2.0
