# Storage Architecture (Phase 2)

## Current Status

- **Phase 1 ✅**: Crawling returns structured data
- **Phase 2 🔄**: Adding persistent storage layer

## Planned Implementation

```typescript
// Phase 2: SQLite + JSON files
const contentHash = hashContent(data);
if (!(await metadataStore.isDuplicate(contentHash))) {
  const cid = await contentStore.store(data);
  await metadataStore.updateCID(contentHash, cid);
}
```

## Future: Smart contracts + Codex storage
