# Analysis Framework

## Architecture

Pluggable processing strategies configured per source in YAML

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

## Configuration

```yaml
sources:
  - id: "eff"
    # ...crawler config...
    processingStrategies:
      - "digital-rights-classifier"
      - "sentiment-analyzer"
      - "keyword-extractor"
```

## Strategy Categories

- **Text Analysis**: Keyword extraction, NER, summarization
- **Classification**: Digital rights topics, multi-label classification
- **Sentiment**: Positive/negative/neutral, emotion detection
- **Trends**: Frequency analysis, anomaly detection
- **Relevance**: Quality assessment, urgency detection
