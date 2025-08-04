# SQLite Metadata Store

## Overview

The SQLite Metadata Store provides fast metadata tracking and querying capabilities for crawled content. It stores metadata in a SQLite database while keeping the actual content in content-addressed JSON files.

## Features

- **Fast Duplicate Detection**: Check if content exists without filesystem operations
- **Rich Querying**: Query by source, date range, with pagination support
- **Content Addressing**: Links metadata to content files via SHA-1 hashes
- **Automatic Schema Management**: Database and tables created automatically
- **Graceful Error Handling**: Content storage continues even if metadata fails
- **Performance Optimized**: Prepared statements and WAL mode for concurrency

## Database Schema

```sql
CREATE TABLE crawled_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  published_date DATETIME,
  crawled_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Optimized indexes
CREATE INDEX idx_source ON crawled_content(source);
CREATE INDEX idx_crawled_at ON crawled_content(crawled_at);
CREATE INDEX idx_published_date ON crawled_content(published_date);
CREATE INDEX idx_hash ON crawled_content(hash);
CREATE INDEX idx_url ON crawled_content(url);
```

## Usage

### Basic Setup

```typescript
import { ContentStore } from "@ethos/lib";

// Enable metadata store
const contentStore = new ContentStore({
  storageDir: "./storage/content",
  enableMetadata: true,
  metadataOptions: {
    dbPath: "./storage/metadata.db",
  },
});

// Store content (both JSON file + metadata)
const result = await contentStore.store(crawledData);
console.log(`Stored with hash: ${result.hash}`);
console.log(`Metadata ID: ${result.metadata?.id}`);
```

### Disable Metadata (Content-Only)

```typescript
const contentStore = new ContentStore({
  storageDir: "./storage/content",
  enableMetadata: false, // Only JSON files, no metadata
});
```

### Direct Metadata Operations

```typescript
const metadataStore = contentStore.getMetadataStore();

// Check existence (fast!)
const exists = metadataStore.existsByUrl("https://example.com/article");
const hashExists = metadataStore.existsByHash("abc123...");

// Get metadata by hash
const metadata = metadataStore.getByHash("abc123...");
console.log(metadata?.title);
```

### Querying

```typescript
const metadataStore = contentStore.getMetadataStore();

// Get all content from a source
const effArticles = metadataStore.getBySource("eff");

// Query with filters and pagination
const recentArticles = metadataStore.query({
  source: "eff",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-01-31"),
  limit: 10,
  offset: 0,
});

// Get source statistics
const sources = metadataStore.getSources();
// Returns: [{ source: "eff", count: 25 }, { source: "aclu", count: 12 }]

// Count articles by source
const count = metadataStore.countBySource("eff");
```

## Content vs Metadata Separation

### JSON Files (Content)

- Pure crawled data only
- Content-addressed storage (hash-based filenames)
- No metadata pollution
- Optimal for archival and retrieval

### SQLite Database (Metadata)

- Fast querying and indexing
- Duplicate detection
- Statistics and analytics
- Source management

## Performance Benefits

1. **Fast Duplicate Detection**: O(1) hash lookup vs O(n) filesystem scan
2. **Rich Queries**: SQL-powered filtering, sorting, pagination
3. **Concurrent Access**: SQLite WAL mode supports concurrent reads
4. **Prepared Statements**: Optimized database operations
5. **Indexed Searches**: Fast queries by source, date, hash, URL

## Error Handling

The metadata store is designed to be resilient:

```typescript
// Content storage continues even if metadata fails
const result = await contentStore.store(data);
if (result.metadata?.stored) {
  console.log("Metadata stored successfully");
} else {
  console.log("Content stored, metadata failed (check logs)");
}
```

Common scenarios:

- Database locked: Graceful degradation to filesystem checks
- Constraint violations: Duplicate detection continues working
- Storage failures: Content files take precedence

## Migration from Content-Only

Existing deployments can gradually adopt metadata:

```typescript
// Phase 1: Enable metadata for new content
const contentStore = new ContentStore({
  enableMetadata: true,
});

// Phase 2: Backfill existing content metadata
const existingFiles = await getExistingContentFiles();
for (const file of existingFiles) {
  const data = await contentStore.retrieve(file.url);
  if (data && !metadataStore.existsByUrl(data.url)) {
    await metadataStore.store(data, file.hash);
  }
}
```

## Monitoring and Maintenance

### Database Size

```typescript
// Get database statistics
const sources = metadataStore.getSources();
const totalCount = sources.reduce((sum, s) => sum + s.count, 0);
console.log(`Total articles: ${totalCount}`);
```

### Cleanup

```typescript
// Proper cleanup
contentStore.close(); // Closes metadata database connection
```

### Backup

The SQLite database can be backed up while running:

```bash
sqlite3 storage/metadata.db ".backup backup.db"
```

## API Reference

### ContentStore Options

```typescript
interface ContentStoreOptions {
  storageDir?: string; // Content files directory
  enableMetadata?: boolean; // Enable metadata store (default: true)
  metadataOptions?: MetadataStoreOptions;
}

interface MetadataStoreOptions {
  dbPath?: string; // SQLite database path
}
```

### Metadata Types

```typescript
interface ContentMetadata {
  id?: number; // Database ID
  hash: string; // Content hash
  source: string; // Source name
  url: string; // Original URL
  title: string; // Article title
  author?: string; // Author name
  publishedDate?: Date; // Publication date
  crawledAt: Date; // Crawl timestamp
  createdAt: Date; // Database insert time
}
```

### Query Options

```typescript
interface MetadataQueryOptions {
  source?: string; // Filter by source
  startDate?: Date; // Date range start
  endDate?: Date; // Date range end
  limit?: number; // Result limit
  offset?: number; // Pagination offset
}
```

## Best Practices

1. **Always call close()**: Properly close database connections
2. **Use pagination**: Limit large result sets with `limit`/`offset`
3. **Index-friendly queries**: Query by indexed fields (source, date) for speed
4. **Backup regularly**: SQLite databases should be backed up
5. **Monitor size**: Track database growth and content counts
6. **Handle failures gracefully**: Metadata is optional - content storage takes priority

## Examples

See `src/demo/metadata-store-demo.ts` for a complete working example.
