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
      container_selector: ".main-content" # required - scope field selectors to this container
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
- `exclude_selectors`: Array of CSS selectors for child elements to exclude from text extraction (optional, only applies when `attribute: "text"`)

### Text Exclusion Example

```yaml
content:
  selector: ".article-content"
  attribute: "text"
  exclude_selectors:
    - ".newsletter-signup"
    - ".advertisement"
    - ".social-share"
```

This will extract text from `.article-content` but remove any child elements matching the exclusion selectors before getting the text content.

### Container Selectors

Both `listing.items` and `detail` sections support container selectors:

- **Listing items**: `container_selector` is required - defines the repeating item elements
- **Detail pages**: `container_selector` is required - all field selectors are scoped to this container instead of the entire document

```yaml
detail:
  container_selector: ".article-main"
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
- If `detail` section exists, must have `detail.container_selector` and at least one field

## Selector Format

- CSS selectors: `.class`, `#id`, `element`
- Pseudo-selectors: `:contains('text')`
- Attribute extraction via `attribute` field
