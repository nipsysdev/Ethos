# Library Architecture

## Design

Config-driven, plugin-based architecture with structured storage:

- **Sources**: YAML configs (non-technical users)
- **Crawlers**: Reusable crawling patterns
- **Storage**: Hybrid metadata + content storage with deduplication
- **Strategies**: Code-based analysis (on-demand processing)

## Core Components

### Source Configuration

```typescript
interface SourceConfig {
  id: string;
  name: string;
  type: "article-listing" | "rss" | "api" | "social";
  listing: { url: string; itemSelector: string; pagination?: any };
  extraction: {
    inline?: Record<string, string>; // Data on listing page
    detail?: Record<string, string>; // Data on article pages
  };
  processingStrategies: string[]; // Applied on-demand
}
```

### Processing Pipeline

1. Load YAML config → 2. Select crawler → 3. Extract content → 4. Store with deduplication → 5. Analysis on-demand

## Directory Structure

```
packages/lib/src/
├── core/                    # Registries + Pipeline
├── crawlers/               # ArticleListing, RSS, API, Social
├── storage/                # MetadataStore + ContentStore implementations
├── strategies/             # Processing implementations (on-demand)
├── config/                 # sources.yaml
└── utils/                  # Selectors, validation, retry
```

## Storage Integration

### Storage Flow

```typescript
// Crawl → Store → Index
const data = await crawler.crawl(source);
const contentHash = hashContent(data);

if (!(await metadataStore.isDuplicate(contentHash))) {
  await metadataStore.markUploading(contentHash, metadata);
  const cid = await contentStore.store(data);
  await metadataStore.updateCID(contentHash, cid);
}
```

### Query Interface

```typescript
// Research queries
const events = await metadataStore.getEvents({
  sourceId: "eff",
  since: Date.now() - 7 * 24 * 60 * 60 * 1000,
  status: "stored",
});

// Analysis on-demand
const results = await Promise.all(
  events.map(async (event) => {
    const content = await contentStore.retrieve(event.cid);
    return analyzeContent(content, strategies);
  })
);
```

## Extension Points

### Add Source (YAML)

```yaml
sources:
  - id: "eff"
    type: "article-listing"
    listing:
      url: "https://eff.org/updates"
      itemSelector: ".views-row"
    extraction:
      detail:
        url: ".views-field-title a@href"
        title: "h1.page-title"
        content: ".field-name-body"
    processingStrategies: ["digital-rights-classifier"]
```

### Add Strategy (TypeScript)

```typescript
export class CustomAnalyzer implements ProcessingStrategy {
  id = "custom-analyzer";
  async process(data: CrawledData): Promise<AnalysisResult> {
    // Custom analysis logic
  }
}
```

## Development vs Production

**Development**: SQLite + JSON files
**Production**: Sepolia smart contract + Codex storage

The library uses identical interfaces for both, enabling seamless migration.
