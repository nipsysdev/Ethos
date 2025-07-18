# Analysis Framework

## Core Concept

On-demand analysis - data is processed when needed, not stored pre-analyzed.

## Strategy System

```typescript
interface ProcessingStrategy {
  id: string;
  process(data: CrawledData): Promise<AnalysisResult>;
}
```

## Usage Patterns

- Apply during queries: `ethos query --analyze keywords,sentiment`
- Chain strategies: `keywords → classification → urgency-detection`
- Filter by confidence: `--threshold 0.8`

## Built-in Strategies

- `keywords`: Extract important terms
- `classification`: Categorize content
- `sentiment`: Analyze tone/emotion
- `urgency`: Detect time-critical issues
