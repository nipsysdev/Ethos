# Storage Architecture

## Four-Phase Pipeline

1. **Crawling** - Extract data from sources (Phase 1 - current)
2. **Storing** - Deduplicate and store with content addressing (Phase 2 - next)
3. **CLI Interface** - Comprehensive command-line interface (Phase 3 - future)
4. **Analysis** - On-demand processing of stored data (Phase 4 - future)

## Architecture

**Phase 2 Implementation:**

- SQLite database (metadata + deduplication)
- JSON files (content storage)

**Future (Not Planned Yet):**

- Sepolia smart contract (coordination + metadata)
- Codex storage (decentralized content)

## Storage Flow

```typescript
const contentHash = hashContent(data);
if (!(await metadataStore.isDuplicate(contentHash))) {
  const cid = await contentStore.store(data);
  await metadataStore.updateCID(contentHash, cid);
}
```

## Deduplication

Content-addressed storage prevents duplicate data. Hash-based deduplication checks happen before storage.
