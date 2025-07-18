# YAML Schema and Validation

## Common Fields (All Types)

```yaml
id: string # Unique identifier
name: string # Human-readable name
type: string # Crawler type: "listing"|"rss"|"api"|"social"
url: string # Base URL
settings: # Optional crawler settings
  delay: number # Delay between requests (ms)
  retries: number # Retry attempts
```

## Type-Specific Schemas

### Listing Crawler

```yaml
type: "listing"
pagination:
  nextSelector: string # Next button selector
items:
  selector: string # Item container selector
  fields:
    required:
      detailUrl: string # Detail page URL (always required)
    optional:
      [key]: string # Optional field selectors
detail:
  fields:
    required:
      [key]: string # Required detail page fields
    optional:
      [key]: string # Optional detail page fields
```

### RSS Crawler

```yaml
type: "rss"
fields:
  required:
    title: string # Title field name
    content: string # Content field name
    url: string # URL field name
  optional:
    [key]: string # Optional field mapping
```

### API Crawler

```yaml
type: "api"
authentication:              # Optional
  type: "apikey"|"bearer"|"basic"
  key: string                # For apikey/bearer
parameters:                  # Optional request params
  [key]: string|number|boolean
fields:
  required:
    title: string            # Title field path
    content: string          # Content field path
    url: string              # URL field path
  optional:
    [key]: string            # Optional field paths
```

## Validation Rules

- **Listing**: Must have `items.selector`, `items.fields.required.detailUrl`, `detail.fields.required`
- **RSS**: Must have `fields.required.title`, `fields.required.content`, `fields.required.url`
- **API**: Must have `fields.required.title`, `fields.required.content`, `fields.required.url`

## Selector Format

- CSS selectors: `.class`, `#id`, `element`
- Attribute extraction: `a@href`, `img@src`
- XPath selectors: `/xpath/expression`
