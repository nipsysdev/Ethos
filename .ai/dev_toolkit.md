# Dev Toolkit

## Commands

```bash
# Root level
pnpm install/build/test/watch/clean

# CLI (Phase 1 complete)
cd packages/lib && pnpm cli
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
