# Ethos

This project started as an initiative by the [Logos Network](https://logos.co/) community.

## What is Ethos?

In its current state, Ethos is a web crawler designed to browse specific sources in order to retrieve publications about civil liberties and digital rights protection.\
Ethos features a built-in Web API serving the retrieved content in Markdown. This enables algorithms and AI agents to easily use those publications for data analysis, notifications, or other purposes.

### The censorship-resistant archiving mission

Beside serving those publications, another goal behind the development of Ethos is to preserve those publications in an immutable and decentralized storage network like [Codex](https://codex.storage/), an incorruptible and persistent archive.

## Current supported sources

- Access Now: https://www.accessnow.org/news-updates/?_language=english
- Declassified UK: https://www.declassifieduk.org/category/archive/
- Electronic Frontier Foundation: https://www.eff.org/updates
- Freedom of the Press Foundation: https://freedom.press/issues
- Logos Press Engine: https://press.logos.co/search?type=article
- P2P Foundation: https://blog.p2pfoundation.net/
- Torrent Freak: https://torrentfreak.com/

## Running Ethos locally

### Get started

#### Install as global package

`npm i -g ethos-crawler` then `ethos`

#### Or, run directly using NPX

`npx ethos-crawler`

### Storage initialization

Upon the first run, Ethos will initialize an `.ethos` folder within the current directory.
To keep using the same dataset, run Ethos from the same path.

### Interactive Menu

Ethos can be used interactively. By using the menu, you will be able to crawl, access past sessions summaries and data, as well as cleaning the database and storage.

```
$ ethos
? Select a command: (Use arrow keys)
❯ crawl - Start crawling a source
  sessions - Browse previous crawl sessions
  clean - Clean stored data
  exit - Exit the program
```

### Commands

#### Crawl - Executing a crawl operation

```
$ ethos crawl --help
Usage: ethos crawl [options] <source>

Crawl a source for content

Arguments:
  source                    Source ID to crawl

Options:
  -m, --max-pages <number>  Maximum number of pages to crawl
  --force-full-crawl        Continue crawling when reached previous crawl session URLs
  --recrawl                 Re-crawl and override existing URLs data
  -o, --output <format>     Output format (json|summary) (default: "summary")
  -h, --help                display help for command
```

##### Notes

- Avoid running multiple crawl operations at the same time, as currently encountering database lock triggers an exception which ends the crawling (could be improved)

#### Serve - Starting the API server

```
$ ethos serve --help
Usage: ethos serve [options]

Start the REST API server

Options:
  -p, --port <number>  Port to run the server on
  -h, --host <string>  Host to bind the server to
  --help               display help for command
```

## Consuming the API

### Prerequisite

- Running the Ethos API locally
- Or, querying an existing API instance

### Endpoints

#### GET `/health`

Health check endpoint to verify the API is running.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2023-12-01T10:30:00.000Z"
}
```

#### GET `/sources`

Get list of available sources for crawling.

**Response:**

```json
[
  {
    "id": "electronic_frontier_foundation",
    "name": "Electronic Frontier Foundation"
  },
  {
    "id": "freedom_press_foundation",
    "name": "Freedom of the Press Foundation"
  },
  {
    "id": "logos_press_engine",
    "name": "Logos Press Engine"
  },
  ...
]
```

#### GET `/publications`

Retrieve publications with filtering and pagination.

**Query Parameters:**

- `page` (number, default: 1) - Page number for pagination
- `limit` (number, default: 10, max: 100) - Items per page
- `source` (string) - Filter by source ID
- `startPublishedDate` (string) - Filter by start date (ISO 8601 format)
- `endPublishedDate` (string) - Filter by end date (ISO 8601 format)

**Response:**

```json
{
  "results": [
    {
      "url": "https://www.eff.org/deeplinks/2025/09/our-stop-censoring-abortion-campaign-uncovers-social-media-censorship-crisis",
      "title": "Our Stop Censoring Abortion Campaign Uncovers a Social Media Censorship Crisis",
      "content": "BY **[JENNIFER PINSOF](https://www.eff.org/about/staff/jennifer-pinsof)** | September 15, 2025\n\n_This is the first installment in a blog series documenting EFF's findings from the_ [_Stop Censoring Abortion_](https://www.eff.org/deeplinks/2025/02/stop-censoring-abortion-fight-reproductive-rights-digital-age) _campaign...",
      "author": "by Jennifer Pinsof",
      "publishedDate": "2025-09-15T00:00:00.000Z",
      "source": "electronic_frontier_foundation",
      "crawledAt": "2025-09-16T18:26:36.831Z",
      "hash": "e5b71cceb7f07494724cf3fd8e2417ad51397b52"
    }
    ...
  ],
  "meta": {
    "total": 33,
    "page": 1,
    "limit": 10,
    "totalPages": 4
  }
}
```

#### GET `/publications/:hash`

Retrieve a specific publication by its hash.

**Parameters:**

- `hash` (string, required) - The unique hash identifier of the content

**Response:**

```json
{
  "url": "https://www.eff.org/deeplinks/2025/09/our-stop-censoring-abortion-campaign-uncovers-social-media-censorship-crisis",
  "title": "Our Stop Censoring Abortion Campaign Uncovers a Social Media Censorship Crisis",
  "content": "BY **[JENNIFER PINSOF](https://www.eff.org/about/staff/jennifer-pinsof)** | September 15, 2025\n\n_This is the first installment in a blog series documenting EFF's findings from the_ [_Stop Censoring Abortion_](https://www.eff.org/deeplinks/2025/02/stop-censoring-abortion-fight-reproductive-rights-digital-age) _campaign...",
  "author": "by Jennifer Pinsof",
  "publishedDate": "2025-09-15T00:00:00.000Z",
  "source": "electronic_frontier_foundation",
  "crawledAt": "2025-09-16T18:26:36.831Z",
  "hash": "e5b71cceb7f07494724cf3fd8e2417ad51397b52"
}
```

#### Error responses

All endpoints return appropriate HTTP status codes and error objects:

```json
{
  "error": {
    "type": "NOT_FOUND|VALIDATION_ERROR|INTERNAL_ERROR",
    "message": "Human-readable error description"
  }
}
```

## Contribute

Join the [Logos discord](https://discord.gg/logosnetwork), feel free to introduce yourself, and get in touch with one of the contributors.

## Contributors

<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nipsysdev"><img src="https://avatars.githubusercontent.com/u/10484855?s=100&v=4" width="100px;" alt="Kent C. Dodds"/><br /><sub><b>Xav (@nipsysdev)</b></sub></a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/JosiahWarren"><img src="https://avatars.githubusercontent.com/u/216360104?s=100&v=4" width="100px;" alt="Jeroen Engels"/><br /><sub><b>Josiah Warren</b></sub></a></td>
    </tr>
  </tbody>
</table>
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

## License

### MIT
