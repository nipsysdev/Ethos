# Crawling Implementation

## Phase 1 Focus: Listing Crawler

For paginated sites with item listings → detail pages. Current YAML schema expects detail page configuration.

```yaml
type: "listing"
url: "https://www.eff.org/updates"
pagination:
  nextSelector: ".pager-next"
items:
  selector: ".views-row"
  fields:
    required:
      detailUrl: ".views-field-title a@href" # Required for detail page extraction
    optional:
      title: ".views-field-title a"
detail:
  fields:
    required:
      title: "h1.page-title"
      content: ".field-name-body"
    optional:
      author: ".field-name-author"
```

## Future Crawler Types

RSS, API, and social media crawlers will be added in future phases.

```yaml
type: "rss"
url: "https://ooni.org/blog/feed.xml"
fields:
  required:
    title: "title"
    content: "content"
    url: "link"
```

### API Crawler

```yaml
type: "api"
url: "https://api.example.com/data"
authentication:
  type: "apikey"
  key: "${API_KEY}"
fields:
  required:
    title: "title"
    content: "content"
```

## Error Handling Philosophy

- **Required Fields**: Extraction failure = abort current page/item
- **Optional Fields**: Missing data = continue extraction
- **Per-Page Validation**: Errors evaluated at end of each page
- **Graceful Degradation**: Failed pages logged, crawl continues

## Runtime vs Config

- **YAML Config**: Crawler behavior, selectors, field definitions
- **Runtime Args**: Execution params (`--max-pages`, `--since`, `--parallel`)

## Validation

Each crawler type has JSON schema validation. CSS selectors use `@` for attributes (`a@href`). XPath supported with `/` prefix.
