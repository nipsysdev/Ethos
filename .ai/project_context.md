# Project Context

## Overview

- Project: Logos Data Collection System
- Goal: Create decentralized system for collecting and analyzing data about digital rights issues
- Components: Library, Node Software, Notifier

## Technologies

- Waku: Decentralized messaging
- Codex: Decentralized storage
- TypeScript: Primary development language
- Playwright: Web scraping
- Commander.js: CLI interface

## Architecture

1. **Library**:

   - Core scraping and analysis logic
   - Modular design for reuse
   - Includes CLI for testing

2. **Node Software**:

   - Uses library for core functionality
   - Communicates via Waku
   - Persists data in Codex
   - Potential Sepolia blockchain integration

3. **Notifier**:
   - Receives messages via Waku
   - Sends notifications to Discord/other services
   - Alerts Logos team about relevant stories/events

## Key Decisions

- Monorepo structure for code organization
- TypeScript for type safety and maintainability
- Playwright for reliable web scraping
- Modular library design for flexibility

## References

- Waku: https://waku.org/
- Codex: https://codex.storage/
