# YAML Schema and Validation

## Phase 1 Focus: Listing Crawler Only

Currently only supporting listing crawlers. Other types (RSS, API) will be figured out when we get to implementing them.

## Schema Structure

The YAML config uses a `sources` array with listing crawler configurations:

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

## Field Configuration

### Required vs Optional Fields

- **Required fields** (default): If extraction fails, the entire page/item fails
- **Optional fields**: Add `optional: true` - if extraction fails, continue with null value

### Field Structure

Each field has:

- `selector`: CSS selector to find the element
- `attribute`: What to extract (`text`, `href`, `src`, etc.)
- `optional`: Whether field is optional (defaults to false/required)

## Validation Rules

- Must have `id`, `name`, `type: "listing"`
- Must have `listing.url`
- Must have `listing.items.container_selector`
- Must have at least one item field
- Must have `detail.fields` with at least one field

## Selector Format

- CSS selectors: `.class`, `#id`, `element`
- Pseudo-selectors: `:contains('text')`
- Attribute extraction via `attribute` field
