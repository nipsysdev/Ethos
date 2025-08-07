# @ethos/lib

YAML-driven web crawlers for digital rights monitoring. Core library of the Ethos system.

## What This Library Does

Configurable web scrapers that extract data from digital rights organizations. Uses YAML configs to define crawling rules.

## Quick Start

### As a Library

```typescript
import { SourceRegistry, CrawlerRegistry } from "@ethos/lib";

// Load sources and run crawler
const sources = SourceRegistry.loadSources("config/sources.yaml");
const crawler = CrawlerRegistry.getCrawler("listing");
const results = await crawler.crawl(sources[0]);
```

### Using the CLI

```bash
# Build and run
pnpm build
pnpm cli
```

## YAML Configuration

Configure crawlers with YAML. Example for EFF updates:

```yaml
sources:
  - id: "eff"
    name: "Electronic Frontier Foundation"
    type: "listing"

    listing:
      url: "https://eff.org/updates"

      pagination:
        next_button_selector: ".pager__item.pager__item--next a"

      items:
        container_selector: ".views-row article.node"
        fields:
          title:
            selector: ".node__title"
            attribute: "text"
          url:
            selector: ".node__title a"
            attribute: "href"
          date:
            selector: ".node-date"
            attribute: "text"
          author:
            selector: ".node-author"
            attribute: "text"
            optional: true
          excerpt:
            selector: ".node__content"
            attribute: "text"
            optional: true
          image:
            selector: ".teaser-thumbnail img"
            attribute: "src"
            optional: true

    content:
      container_selector: ".node-type-blog"
      fields:
        content:
          selector: ".pane-node .node__content"
          attribute: "text"
```

## License

Apache License 2.0
