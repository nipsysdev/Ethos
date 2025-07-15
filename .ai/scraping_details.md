# Crawling Implementation

## Architecture

Config-driven crawling with two-step pattern: listing page → individual articles

## Primary Crawler: Article Listing

```yaml
sources:
  - id: "eff"
    type: "article-listing"
    listing:
      url: "https://eff.org/updates"
      itemSelector: ".views-row"
      pagination: { type: "load-more", selector: ".pager-next" }
    extraction:
      inline: # Data on listing page
        title: ".views-field-title a"
        date: ".views-field-created"
      detail: # Data on article page
        url: ".views-field-title a@href"
        title: "h1.page-title"
        content: ".field-name-body"
    processingStrategies: ["digital-rights-classifier"]
```

## Data Structure

```typescript
interface CrawledData {
  url: string;
  timestamp: Date;
  source: string;
  title: string;
  content: string;
  excerpt?: string;
  author?: string;
  tags?: string[];
  metadata: Record<string, unknown>;
}
```

## Source Categories

- **Search/Filter**: Civicus, Acled, Privacy International, Court Listener, Lumen
- **News/Updates**: AccessNow, EFF, Torrentfreak, Big Brother Watch
- **Archives**: Citizenlab, Declassified UK, Freedom Press
- **Databases**: Crisisgroup, Global Protest Tracker

## Puppeteer Config

Headless mode, stealth plugins, adblocker, retry logic
