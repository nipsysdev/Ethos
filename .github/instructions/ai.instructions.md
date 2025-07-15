---
applyTo: "**"
---

# AI Documentation Guidelines

## ⚠️ STOP - READ THIS FIRST

**BEFORE doing ANYTHING else, you MUST follow this workflow:**

### Required Workflow

1. **First, check for `.ai` directory documentation**

   ```bash
   # Search .ai docs for relevant keywords
   grep -r "relevant_keywords" .ai/
   ```

2. **Read applicable documentation in this order:**

   - `.ai/project_context.md` - Project overview and core concepts
   - `.ai/monorepo_setup.md` - Monorepo structure and tooling
   - `.ai/cli_interface.md` - CLI commands and usage
   - `.ai/scraping_details.md` - Web crawling implementation
   - `.ai/analysis_framework.md` - Data analysis components
   - `.ai/waku_integration.md` - Waku messaging integration (if working with node/notifier)
   - `.ai/codex_integration.md` - Codex storage integration (if working with node/notifier)

3. **Acknowledge understanding by stating:**

   - "After reading .ai/[FILE].md, I understand that..."
   - Reference specific patterns or conventions you'll follow

4. **THEN proceed with your task**

## Purpose

The `.ai` directory contains comprehensive documentation to help AI agents quickly understand and continue development on the Ethos project. Ethos is a decentralized data collection system for digital rights issues that uses Waku for messaging and Codex for storage. The documentation serves as a knowledge base for the project's architecture, monorepo setup, and development process.

## Usage Guidelines

1. **ALWAYS consult the `.ai` documentation when starting work on the Ethos project**
2. Use the documentation to understand the monorepo structure and development conventions
3. Reference specific patterns from the docs in your implementation
4. When working with web crawling, check `.ai/scraping_details.md` for crawler patterns
5. When working with the CLI, reference `.ai/cli_interface.md` for command structure
6. When working with Waku/Codex integration, check the respective integration docs
7. When in doubt, search the `.ai` files for guidance

## Maintenance

1. Update the documentation when making significant changes to the Ethos project
2. Keep the documentation accurate and up-to-date with the current monorepo structure
3. Add new sections when introducing major features or architectural changes
4. Remove outdated information promptly
5. Update integration docs when Waku/Codex APIs change

## Decision Making

1. Use the documentation as a reference when making architectural decisions
2. Follow established patterns and conventions documented in `.ai`
3. Consider the impact of changes on documented components and features
4. Update documentation to reflect any approved changes
