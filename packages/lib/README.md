# @ethos/lib

Core crawling and analysis library for the Ethos data collection system. Provides config-driven web crawling with pluggable analysis strategies for digital rights monitoring.

## Features

- **Config-driven sources**: Add new websites via YAML configuration
- **Two-step crawling**: Listing pages → individual articles
- **Pluggable strategies**: Custom analysis modules for data processing
- **Multiple crawler types**: Article listings, RSS feeds, APIs, social media
- **Interactive CLI**: Test and manage crawling operations
- **TypeScript**: Full type safety and IntelliSense support

## Installation

```bash
pnpm add @ethos/lib
```

## Quick Start

### Using the CLI

```bash
# Interactive mode
node dist/cli/index.js

# Or build and run
pnpm run build
node dist/cli/index.js
```

### Programmatic Usage

```typescript
import {
  SourceRegistry,
  CrawlerRegistry,
  StrategyRegistry,
  ProcessingPipeline,
  ArticleListingCrawler,
  KeywordExtractor,
} from "@ethos/lib";

// Initialize the system
const sourceRegistry = new SourceRegistry("./config/sources.yaml");
const crawlerRegistry = new CrawlerRegistry();
const strategyRegistry = new StrategyRegistry();
const pipeline = new ProcessingPipeline(crawlerRegistry, strategyRegistry);

// Register crawlers and strategies
crawlerRegistry.register(new ArticleListingCrawler());
strategyRegistry.register(new KeywordExtractor());

// Process a source
const source = await sourceRegistry.getSource("eff");
const results = await pipeline.process(source);
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
        author: ".author"
    processingStrategies:
      - "keyword-extractor"
      - "sentiment-analyzer"
```

### Creating Analysis Strategies

```typescript
import { ProcessingStrategy, CrawledData, AnalysisResult } from "@ethos/lib";

export class MyAnalyzer implements ProcessingStrategy {
  id = "my-analyzer";
  name = "My Custom Analyzer";
  description = "Does custom analysis";

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

## Architecture

The library uses a plugin-based architecture:

- **Sources**: YAML configs for non-technical users
- **Crawlers**: Reusable crawling patterns (article-listing, RSS, API, etc.)
- **Strategies**: Code-based analysis modules
- **Registries**: Manage available crawlers and strategies
- **Pipeline**: Orchestrates crawling + analysis

## Available Crawlers

- **ArticleListingCrawler**: Two-step crawling (listing → articles)
- More crawler types coming soon...

## Available Strategies

- **KeywordExtractor**: Finds digital rights keywords and topics
- More analysis strategies coming soon...

## Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Build the package:

   ```bash
   pnpm run build
   ```

3. Run in development mode:

   ```bash
   pnpm run watch
   ```

4. Test the CLI:

   ```bash
   pnpm run build
   node dist/cli/index.js
   ```

5. Run tests:
   ```bash
   pnpm test
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
├── strategies/             # Analysis strategy implementations
│   └── implementations/
│       └── KeywordExtractor.ts
├── config/                 # Configuration files
│   └── sources.yaml       # Source definitions
├── cli/                    # Command-line interface
│   └── index.ts
└── utils/                  # Utility functions
```

## Contributing

1. Add new sources by editing `src/config/sources.yaml`
2. Create new analysis strategies in `src/strategies/implementations/`
3. Register new components in the appropriate registries
4. Follow the existing patterns and TypeScript conventions

## License

Apache License 2.0
