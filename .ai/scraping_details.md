# Crawling Implementation

## Core Requirements

- Support for 20+ human rights/digital freedom websites
- Puppeteer-based crawling
- Metadata extraction (URL, timestamp, source, content)

## Puppeteer Configuration

- Headless mode by default
- Custom user agent
- Request interception for efficiency
- Automatic retry logic

## Data Structure

```typescript
interface CrawledData {
  url: string;
  timestamp: Date;
  source: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}
```

## Website Specifics

- Each source gets dedicated crawler
- Common extraction patterns:
  - Article content
  - Publication date
  - Author information
  - Tags/categories
