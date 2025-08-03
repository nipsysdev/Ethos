# Library Architecture

## Core Classes (Phase 1 ✅)

- **SourceRegistry**: Load/validate YAML configs
- **CrawlerRegistry**: Manage crawler implementations
- **ArticleListingCrawler**: Pagination + item + detail extraction
- **ProcessingPipeline**: Orchestrate operations

## Storage Classes (Phase 2 ✅)

- **ContentStore**: Content-addressed JSON storage with SHA-1 hashing

## Flow

1. Load YAML → Validate config
2. Get crawler → Process pages
3. Extract items → Optional details
4. **Store data** → Content-addressed files
5. Return structured data + stats

## Error Handling

- Required fields: skip item, continue
- Optional fields: undefined value, continue
- Page failures: log error, continue crawl
- URL deduplication: automatic
- Storage failures: error thrown with context

## Integration Points

The ContentStore can be used independently or integrated into the ProcessingPipeline for automatic storage of crawled data.
