# Library Architecture

## Design

Config-driven, plugin-based architecture:

- **Sources**: YAML configs (non-technical users)
- **Crawlers**: Reusable crawling patterns
- **Strategies**: Code-based analysis (data analysts)

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
  processingStrategies: string[];
}
```

### Processing Pipeline

1. Load YAML config → 2. Select crawler → 3. Extract content → 4. Apply strategies → 5. Output results

## Directory Structure

```
packages/lib/src/
├── core/                    # Registries + Pipeline
├── crawlers/               # ArticleListing, RSS, API, Social
├── strategies/             # Processing implementations
├── config/                 # sources.yaml
└── utils/                  # Selectors, validation, retry
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
