# Monorepo Setup

## Structure

- `packages/lib`: Shared library code
- `packages/node`: Node.js implementations
- `packages/notifier`: Notification system

## Tooling

- **PNPM**: Package management
- **Lerna**: Monorepo operations (`bootstrap`, `build`, `watch`, `clean`)
- **Biome**: Linting/formatting (tab indentation, double quotes)
- **Lefthook**: Git hooks

## Workflow

```bash
pnpm install
pnpm run bootstrap
pnpm run watch
```
