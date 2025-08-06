# Storage Architecture (Phase 2)

## Current Status

- **Phase 1 ✅**: Crawling returns structured data
- **Phase 2 🔄**: Content-addressed storage implemented

## Content Store Implementation

The `ContentStore` class provides content-addressed storage using SHA-1 hashes:

```typescript
import { ContentStore } from "@ethos/lib";

const contentStore = new ContentStore();
const result = await contentStore.store(crawledData);
// Returns: { hash: 'abc123...', path: './storage/content/abc123....json', existed: false }

// Configure concurrent content crawling
const options = {
  maxPages: 5,
  contentConcurrency: 5, // Process 5 content pages concurrently
};
const crawlResult = await crawler.crawl(config, options);
```

### Features

- **Content addressing**: Files named by content hash for automatic deduplication
- **Directory management**: Auto-creates `./storage/content/` directory
- **Error handling**: Graceful filesystem error handling
- **Flexible configuration**: Custom storage directory and hash algorithms
- **Concurrent content crawling**: Configurable concurrency for content page extraction (default: 5, backward compatible with `contentConcurrency`)

### File Structure

```
./storage/
  content/
    {hash}.json  # Content-addressed JSON files
    {hash}.json
    ...
```

## Future: Smart contracts + Codex storage

Phase 3 will integrate with Logos' Codex for decentralized storage while maintaining the content-addressed approach.
