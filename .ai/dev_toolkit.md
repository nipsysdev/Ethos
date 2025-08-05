# Dev Toolkit

## Commands

```bash
# Root level
pnpm install/build/test/watch/clean

# CLI (Phase 1 complete)
cd packages/lib && pnpm cli

# Testing - ALWAYS use pnpm
pnpm test                    # Run all tests
pnpm test src/path/file.ts   # Run specific test
cd packages/lib && pnpm test # Test specific package
```

## Structure

```
packages/lib/     # Core library (current focus)
packages/node/    # Network service (future)
packages/notifier/ # Client apps (future)
```

## Tools

- **Biome**: lint/format (`pnpm lint`, `pnpm format`)
- **TypeScript**: strict mode, Node 22+
- **Vite**: build tool
- **pnpm**: workspace manager
