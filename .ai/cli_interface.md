# CLI Interface

## Core Commands

````ba## Configuration

```bash
ethos config list             # Show current configuration
ethos config set <key> <val>  # Set configuration value
ethos config sources          # Manage source configurations
```awling
ethos crawl <source>           # Crawl specific source
ethos crawl --all              # Crawl all sources

# Querying
ethos query [options]          # Query stored events
ethos list                     # List stored events
ethos show <cid>               # Show content by CID

# Management
ethos status                   # Storage status and stats
ethos clean                    # Clean up failed uploads
````

## Common Options

```bash
# Crawl options
ethos crawl eff --max-pages 5 --since "2024-01-01" --parallel 2

# Query options
ethos query --source eff --since "2024-01-01" --output results.json
```

## Runtime Parameters

- `--max-pages`: Limit pagination depth
- `--since`: Filter by date
- `--parallel`: Concurrent processing
- `--dry-run`: Validate without crawling
- `--verbose`: Detailed logging
- `--force`: Force re-crawl without deduplication
- `--interval`: Batch crawl interval (e.g., 1h, 30m)
- `--daemon`: Run as background daemon

## Configuration

```bash
ethos config list             # Show current configuration
ethos config set <key> <val>  # Set configuration value
ethos config sources          # Manage source configurations
```

## Output Formats

## Output Formats

- `json`: Structured JSON output
- `csv`: Tabular data export
- `markdown`: Human-readable reports
- `raw`: Original crawled content

## Development Mode

```bash
# Use specific storage location
ethos --data-dir /tmp/ethos-test crawl eff

# Debug mode with verbose logging
ethos --debug crawl eff

# Simulate production with dry-run
ethos --dry-run crawl --all
```

## Examples

```bash
# Basic workflow
ethos crawl eff
ethos query --source eff --since yesterday

# Research with analysis
ethos query --analyze sentiment,keywords --since "last-month" --output research.json

# Monitoring
ethos monitor --strategies urgency-detector --threshold 0.9

# Data export
ethos export csv --source eff --since "2024-01-01" --output eff-2024.csv
```
