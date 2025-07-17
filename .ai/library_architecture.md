# Library Architecture

## Core Purpose

The TypeScript library contains ALL core logic for crawling, storage access, and analysis. Network nodes use this library to perform continuous operations and respond to client requests.

## Core Flow

1. **Load YAML Config** → Validate listing crawler config
2. **Select Crawler** → Use listing crawler implementation
3. **Extract Content** → Handle pagination, items, details
4. **Store with Deduplication** → Content-addressed storage
5. **Analysis on-demand** → Processing strategies when needed

## Crawler Types

**Phase 1 Focus:**

- **listing**: Paginated item lists → detail pages (current schema expects detail page config)

**Future phases:** RSS, API, social media crawlers

## Error Handling

- **Required fields fail**: Abort current page/item
- **Optional fields fail**: Continue extraction
- **Per-page validation**: Errors evaluated at end of each page

## Storage Pattern

```typescript
// Crawl → Store → Index
const contentHash = hashContent(data);
if (!(await metadataStore.isDuplicate(contentHash))) {
  const cid = await contentStore.store(data);
  await metadataStore.updateCID(contentHash, cid);
}
```

The library provides seamless migration path from simulated to decentralized storage.
