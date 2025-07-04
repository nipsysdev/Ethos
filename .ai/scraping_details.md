# Scraping Implementation

## Core Requirements

- Support for 20+ human rights/digital freedom websites
- Playwright-based scraping
- Metadata extraction (URL, timestamp, source, content)

## Playwright Configuration

- Headless mode by default
- Custom user agent
- Request interception for efficiency
- Automatic retry logic

## Data Structure

```typescript
interface ScrapedData {
  url: string;
  timestamp: Date;
  source: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}
```

## Website Specifics

- Each source gets dedicated scraper
- Common extraction patterns:
  - Article content
  - Publication date
  - Author information
  - Tags/categories
