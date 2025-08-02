# Library Architecture

## Core Classes (Phase 1 ✅)

- **SourceRegistry**: Load/validate YAML configs
- **CrawlerRegistry**: Manage crawler implementations
- **ArticleListingCrawler**: Pagination + item + detail extraction
- **ProcessingPipeline**: Orchestrate operations

## Flow

1. Load YAML → Validate config
2. Get crawler → Process pages
3. Extract items → Optional details
4. Return structured data + stats

## Error Handling

- Required fields: skip item, continue
- Optional fields: undefined value, continue
- Page failures: log error, continue crawl
- URL deduplication: automatic

## Phase 2: Add storage layer between steps 3-4
