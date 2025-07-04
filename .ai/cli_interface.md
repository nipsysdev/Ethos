# CLI Interface

## Core Commands

```bash
logos-crawl [options] <source>
logos-analyze [options] <input>
logos-run [options]
logos-config [options]
```

## Command Details

1. **logos-crawl**:

   - Crawl data from specified source
   - Options:
     - --output: Output file path
     - --headless: Run in headless mode
     - --retries: Number of retry attempts

2. **logos-analyze**:

   - Analyze crawled data
   - Options:
     - --output: Analysis results file
     - --format: Output format (json, csv)
     - --topics: Specific topics to analyze

3. **logos-run**:

   - Run continuous crawling and analysis
   - Options:
     - --interval: Crawling interval
     - --daemon: Run as background process

4. **logos-config**:
   - Manage configuration
   - Subcommands:
     - set <key> <value>
     - get <key>
     - list
     - reset
