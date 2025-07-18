# @ethos/lib

Core library for the Ethos data collection system. Currently focused on building production-ready YAML-driven crawlers.

## What This Library Does

This is the crawling engine for Ethos. It takes YAML configurations and reliably extracts data from digital rights organizations' websites.

## Quick Start

### Using the CLI

```bash
# Build and run
pnpm run build
node dist/cli/index.js
```

## YAML Configuration

The library uses YAML configs to define listing crawlers. Here's the current schema:

```yaml
sources:
  - id: "eff"
    name: "Electronic Frontier Foundation"
    type: "listing"

    listing:
      url: "https://www.eff.org/updates"

      pagination:
        next_button_selector: "a[href]:contains('NEXT')"
        current_page_selector: ".pager-current"

      items:
        container_selector: "article"
        fields:
          title:
            selector: "h3 a"
            attribute: "text"
            # required by default
          url:
            selector: "h3 a"
            attribute: "href"
            # required by default
          date:
            selector: ".date"
            attribute: "text"
            # required by default
          author:
            selector: ".author a"
            attribute: "text"
            optional: true # might not be present on all articles
          excerpt:
            selector: ".excerpt"
            attribute: "text"
            optional: true # might not be present on all articles
          image:
            selector: "img"
            attribute: "src"
            optional: true # not all articles have images

    detail:
      fields:
        content:
          selector: ".content"
          attribute: "text"
          # required - if this fails, the whole detail page fails
```

### Field Behavior

- **Required fields** (default): If extraction fails, the entire page/item fails
- **Optional fields**: Add `optional: true` - if extraction fails, continue with null value

## License

Apache License 2.0
