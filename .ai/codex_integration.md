# Codex Integration

## Role in Architecture

Codex serves as the decentralized content storage layer in the hybrid architecture:

- **Smart Contract**: Coordinates metadata and deduplication
- **Codex**: Stores actual crawled content using content addressing
- **Local Index**: Provides fast query capabilities

## Content Storage Strategy

### What Goes to Codex

**Raw Crawled Data**:

- Article content (HTML, text)
- Extracted structured data
- Source metadata snapshots
- Immutable after storage

**Content Addressing**:

- Each piece of content gets a unique CID
- CID is stored in smart contract for reference
- Enables deduplication across the network

### Data Structure

```typescript
interface CodexStoredContent {
  type: "crawled-data";
  timestamp: number;
  sourceId: string;
  url: string;
  content: {
    title: string;
    body: string;
    html?: string;
    extractedData: Record<string, any>;
  };
  metadata: {
    crawlTime: number;
    sourceVersion: string;
    extractorVersion: string;
  };
}
```

## Storage Flow

```typescript
// 1. Smart contract coordination
const contentHash = hashContent(crawledData);
if (await contract.isStored(contentHash)) {
  return; // Already stored
}

// 2. Mark upload in progress
await contract.markUploading(contentHash, metadata);

// 3. Store in Codex
const cid = await codex.store(crawledData);

// 4. Update contract with CID
await contract.updateCID(contentHash, cid);
```

## Local Development Simulation

During development, Codex is simulated using content-addressed JSON files:

```
~/.ethos/content/
├── bafybeig...abc123.json    # Content-addressed storage
├── bafybeig...def456.json    # Immutable file names
└── ...
```

## Implementation Details

### Storage Operations

```typescript
interface CodexStore {
  store(data: any): Promise<string>; // Returns CID
  retrieve(cid: string): Promise<any>;
  exists(cid: string): Promise<boolean>;
}
```

### Content Addressing

- Content is hashed to generate CID
- Same content always produces same CID
- Enables network-wide deduplication
- Immutable storage (content never changes)

### Error Handling

```typescript
try {
  const cid = await codex.store(content);
  await contract.updateCID(contentHash, cid);
} catch (error) {
  await contract.markFailed(contentHash, error.message);
  // Retry logic or manual intervention
}
```

## Network Coordination

### Multi-Node Scenarios

1. **Node A** and **Node B** crawl same content
2. Both check smart contract - content not found
3. Both attempt to store - smart contract prevents duplicates
4. First successful store wins, second node skips

### Data Availability

- Content replicated across Codex network
- Retrieval through content addressing
- Payment channels for data access
- Local caching for performance

## Benefits

1. **Decentralization**: No single point of failure
2. **Deduplication**: Network-wide content sharing
3. **Immutability**: Permanent data preservation
4. **Scalability**: Distributed storage capacity
5. **Censorship Resistance**: Distributed data access

## Migration Path

1. **Development**: JSON files with CID-style naming
2. **Testing**: Local Codex node integration
3. **Production**: Full Codex network deployment

The storage interface remains consistent across all phases, enabling smooth migration from development to production.
