# CLI Interface

## Core Commands

```bash
crawl [options] <source>
analyze [options] <input>
run [options]
config [options]
```

## Command Details

1. **crawl**:

   - Crawl data from specified source
   - Options:
     - --output: Output file path
     - --headless: Run in headless mode
     - --retries: Number of retry attempts

2. **analyze**:

   - Analyze crawled data
   - Options:
     - --output: Analysis results file
     - --format: Output format (json, csv)
     - --topics: Specific topics to analyze

3. **run**:

   - Run continuous crawling and analysis
   - Options:
     - --interval: Crawling interval
     - --daemon: Run as background process

4. **config**:
   - Manage configuration
   - Subcommands:
     - set <key> <value>
     - get <key>
     - list
     - reset
