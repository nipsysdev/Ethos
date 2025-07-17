# Analysis Framework

## Architecture

On-demand analysis system with pluggable processing strategies. Analysis results are generated when needed rather than stored persistently.

## Strategy Interface

```typescript
interface ProcessingStrategy {
  id: string;
  name: string;
  process(data: CrawledData): Promise<AnalysisResult>;
}

interface AnalysisResult {
  topics: string[];
  sentiment: number;
  relevance: number;
  keywords: string[];
  confidence: number;
  metadata: Record<string, unknown>;
}
```

## On-Demand Processing

Analysis happens during:

- **Query operations**: Real-time analysis for research queries
- **Notification checks**: Evaluate events for alert criteria
- **Batch processing**: Analyze multiple events with improved strategies

```typescript
// Example: Analyze events for notifications
const recentEvents = await metadataStore.getEvents({
  since: Date.now() - 60 * 60 * 1000, // Last hour
});

const criticalEvents = await Promise.all(
  recentEvents.map(async (event) => {
    const content = await contentStore.retrieve(event.cid);
    const analysis = await analyzeContent(content, ["urgency-detector"]);
    return analysis.relevance > 0.8 ? { event, analysis } : null;
  })
).then((results) => results.filter(Boolean));
```

## Example Strategies

### Digital Rights Classifier

```typescript
export class DigitalRightsClassifier implements ProcessingStrategy {
  id = "digital-rights-classifier";

  async process(data: CrawledData): Promise<AnalysisResult> {
    return {
      topics: ["privacy", "surveillance", "censorship"],
      confidence: 0.85,
      relevance: 0.92,
      keywords: ["encryption", "data protection"],
      sentiment: 0.1,
      metadata: { categories: ["digital-rights", "policy"] },
    };
  }
}
```

### Urgency Detector

```typescript
export class UrgencyDetector implements ProcessingStrategy {
  id = "urgency-detector";

  async process(data: CrawledData): Promise<AnalysisResult> {
    const urgentKeywords = ["breaking", "urgent", "critical", "emergency"];
    const hasUrgentKeyword = urgentKeywords.some((keyword) =>
      data.content.toLowerCase().includes(keyword)
    );

    return {
      topics: hasUrgentKeyword ? ["urgent"] : [],
      relevance: hasUrgentKeyword ? 0.95 : 0.3,
      confidence: 0.7,
      keywords: urgentKeywords.filter((k) => data.content.includes(k)),
      sentiment: 0,
      metadata: { urgent: hasUrgentKeyword },
    };
  }
}
```

## Configuration

```yaml
sources:
  - id: "eff"
    # ...crawler config...
    processingStrategies:
      - "digital-rights-classifier"
      - "urgency-detector"
      - "keyword-extractor"
```

## Strategy Categories

- **Text Analysis**: Keyword extraction, NER, summarization
- **Classification**: Digital rights topics, multi-label classification
- **Sentiment**: Positive/negative/neutral, emotion detection
- **Urgency**: Breaking news detection, crisis monitoring
- **Relevance**: Quality assessment, importance scoring

## Benefits of On-Demand Analysis

1. **Strategy Updates**: Improve analysis without re-processing stored data
2. **Storage Efficiency**: Only store raw content, not analysis results
3. **Real-time Processing**: Generate fresh analysis for current needs
4. **Flexible Querying**: Apply different strategies for different use cases

## Usage Patterns

### Research Queries

```typescript
const events = await queryEvents({
  sourceId: "eff",
  since: lastWeek,
  analyze: ["digital-rights-classifier", "sentiment-analyzer"],
});
```

### Notification Processing

```typescript
const alerts = await checkForAlerts({
  strategies: ["urgency-detector", "crisis-monitor"],
  threshold: 0.8,
});
```

### Batch Analysis

```typescript
const insights = await batchAnalyze({
  timeRange: lastMonth,
  strategies: ["trend-analyzer", "topic-clustering"],
});
```
