# Analysis Framework (Phase 4)

## Status: Future implementation

**Concept**: On-demand analysis - process data when queried, not pre-stored.

## Planned Strategy System

```typescript
interface ProcessingStrategy {
  id: string;
  process(data: CrawledData): Promise<AnalysisResult>;
}
```

**Built-in strategies**: keywords, sentiment, classification, urgency detection
