# Storage Architecture

## Overview

Ethos uses a hybrid storage architecture designed for decentralized data collection with built-in deduplication and structured querying capabilities.

## Three-Phase Pipeline

1. **Crawling** - Extract data from configured sources
2. **Storing** - Deduplicate and store in structured format
3. **Analysis** - Run on-demand analysis on stored events

## Final Architecture

**Smart Contract (Sepolia)** - Coordination layer:

- Content hashes for deduplication
- Basic metadata (source, timestamp, status)
- CIDs pointing to Codex storage
- Upload status tracking

**Codex Storage** - Decentralized content storage:

- Raw crawled data (immutable)
- Content-addressed using CIDs
- Distributed across network nodes

**Local Indexing** - Fast query layer:

- Metadata indexes for quick searches
- Event filtering and aggregation
- Research interface queries

## Development Implementation

For local development and testing, we simulate the final architecture:

**SQLite Database** - Simulates smart contract behavior:

- Atomic transactions
- Concurrent access handling
- Deduplication checks
- Status tracking

**JSON Files** - Simulates Codex storage:

- Content-addressed file names
- Immutable storage pattern
- Local content retrieval

## Storage Flow

```typescript
// 1. Hash crawled data for deduplication
const contentHash = hashContent(crawledData);

// 2. Check if already stored
if (await metadataStore.isDuplicate(contentHash)) {
  return; // Skip duplicate
}

// 3. Mark as uploading
await metadataStore.markUploading(contentHash, {
  sourceId: data.source,
  timestamp: Date.now(),
  url: data.url,
});

// 4. Store content
const cid = await contentStore.store(crawledData);

// 5. Update with CID
await metadataStore.updateCID(contentHash, cid);
```

## Directory Structure

```
~/.ethos/
├── metadata.db          # SQLite - events, status, CIDs
└── content/
    ├── abc123.json      # Raw crawled data
    ├── def456.json      # Content-addressed storage
    └── ...
```

## Storage Interfaces

```typescript
interface MetadataStore {
  isDuplicate(contentHash: string): Promise<boolean>;
  markUploading(contentHash: string, metadata: any): Promise<void>;
  updateCID(contentHash: string, cid: string): Promise<void>;
  getEvents(filters?: any): Promise<StoredEvent[]>;
}

interface ContentStore {
  store(data: any): Promise<string>; // Returns CID
  retrieve(cid: string): Promise<any>;
}
```

## Data Separation

**Metadata (Fast Access)**:

- Event existence checks
- Source/timestamp filtering
- Status tracking
- Query optimization

**Content (Bulk Storage)**:

- Raw article text/HTML
- Extracted structured data
- Media files
- Immutable after storage

## Analysis Strategy

Analysis results are generated **on-demand** rather than stored:

- Reduces storage complexity
- Allows strategy updates without re-storing
- Enables real-time analysis improvements
- Simpler deduplication logic

## Migration Path

The local implementation uses identical interfaces to the final architecture:

1. **Development**: SQLite + JSON files
2. **Production**: Sepolia + Codex
3. **Enhanced**: Query optimization and scaling

This approach allows seamless transition from local development to decentralized production.
