# Ethos

This project is part of the [Logos](https://logos.co/) ecosystem. Let's protect freedom.

## What is Ethos?

In its current state, Ethos is a web crawler designed to browse specific sources in order to retrieve their publications. It has a built-in API serving the content, enabling the crawled data to be used for data analysis, notifications, etc...

## The censorship-resistant archiving mission

The goal behind the development of Ethos is to build a tool which retrieves publications about civil liberties (currently mostly focused on digital rights), and preserve those in [Codex](https://codex.storage/), an incorruptible and persistent archive.

Why? Because centralized freedom organisations are [too often](https://press.logos.co/article/save-the-songs) the target of powerful actors who feel threatened by their noble missions.

Reports about human rights must, too, be protected and kept forever accessible.

## Current supported sources

- Electronic Frontier Foundation (EFF): https://www.eff.org/updates
- Freedom of the Press Foundation (FPF): https://freedom.press/issues
- Logos Press Engine (LPE): https://press.logos.co/search?type=article

## Using Ethos locally

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
    "id": "eff",
    "name": "Electronic Frontier Foundation"
  },
  {
    "id": "fpf",
    "name": "Freedom of the Press Foundation"
  },
  {
    "id": "lpe",
    "name": "Logos Press Engine"
  }
]
```

#### GET `/publications`

Retrieve publications with filtering and pagination.

**Query Parameters:**

- `page` (number, default: 1) - Page number for pagination
- `limit` (number, default: 10, max: 100) - Items per page
- `source` (string) - Filter by source ID (eff, fpf, lpe)
- `startPublishedDate` (string) - Filter by start date (ISO 8601 format)
- `endPublishedDate` (string) - Filter by end date (ISO 8601 format)

**Response:**

```json
{
  "results": [
    {
      "url": "https://eff.org/deeplinks/2023/12/example-article",
      "title": "Example Article Title",
      "content": "Full article content text extracted from the source...",
      "author": "By Author Name",
      "publishedDate": "2023-12-01T00:00:00.000Z",
      "image": "https://eff.org/sites/default/files/example-image.jpg",
      "source": "eff",
      "crawledAt": "2023-12-01T10:30:00.000Z",
      "hash": "a1b2c3d4e5f6..."
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15
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
  "url": "https://eff.org/deeplinks/2023/12/example-article",
  "title": "Example Article Title",
  "content": "Full article content text extracted from the source...",
  "author": "By Author Name",
  "publishedDate": "2023-12-01T00:00:00.000Z",
  "image": "https://eff.org/sites/default/files/example-image.jpg",
  "source": "eff",
  "crawledAt": "2023-12-01T10:30:00.000Z",
  "hash": "a1b2c3d4e5f6..."
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

## License

MIT
