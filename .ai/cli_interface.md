# CLI Interface

## Core Commands

### Storage & Crawling

```bash
ethos crawl <source>           # Crawl and store data from source
ethos crawl --all              # Crawl all configured sources
ethos store <file>             # Store external data file
ethos status                   # Show storage status and stats
```

### Querying & Analysis

```bash
ethos query [options]          # Query stored events
ethos analyze [options]        # Run analysis on stored data
ethos monitor [options]        # Monitor for critical events
```

### Data Management

```bash
ethos list                     # List stored events
ethos show <cid>               # Show content by CID
ethos clean                    # Clean up failed uploads
ethos export <format>          # Export data in various formats
```

## Query Options

```bash
# Filter by source and time
ethos query --source eff --since "2024-01-01"

# Apply analysis strategies
ethos query --analyze sentiment,keywords --output results.json

# Monitor for alerts
ethos monitor --strategies urgency-detector --threshold 0.8
```

## Storage Options

```bash
# Crawl with custom analysis
ethos crawl eff --analyze digital-rights-classifier

# Force re-crawl (skip deduplication)
ethos crawl eff --force

# Batch crawl with interval
ethos crawl --all --interval 1h --daemon
```

## Configuration

```bash
ethos config list             # Show current configuration
ethos config set <key> <val>  # Set configuration value
ethos config sources          # Manage source configurations
```

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
