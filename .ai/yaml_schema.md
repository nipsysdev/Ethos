# YAML Schema (Phase 1)

## Structure

```yaml
sources:
  - id: "eff"
    name: "Electronic Frontier Foundation"
    type: "listing"

    listing:
      url: "https://eff.org/updates"
      pagination:
        next_button_selector: ".pager__item--next a"
        current_page_selector: ".pager__item--current"
      items:
        container_selector: ".views-row article.node"
        fields:
          title: { selector: ".node__title", attribute: "text" }
          url: { selector: ".node__title a", attribute: "href" }
          author:
            { selector: ".node-author", attribute: "text", optional: true }

    detail: # Required section
      container_selector: ".main-content"
      fields:
        content: { selector: ".field-name-body", attribute: "text" }
```

## Key Rules

- **Required fields** (default): Skip item if missing, continue crawl
- **Optional fields** (`optional: true`): Set undefined if missing
- **Container selectors**: Scope field searches
- **Runtime options**: `maxPages` (CLI prompts)
- **Detail section**: Required for all sources
  fields:
  title:
  selector: "h1" # searches within .article-main for h1
  content:
  selector: ".content" # searches within .article-main for .content

```

## Validation Rules

- Must have `id`, `name`, `type: "listing"`
- Must have `listing.url`
- Must have `listing.items.container_selector`
- Must have at least one item field
- Must have `detail` section with `detail.container_selector` and at least one field

## Selector Format

- CSS selectors: `.class`, `#id`, `element`
- Pseudo-selectors: `:contains('text')`
- Attribute extraction via `attribute` field
```
