# Dev Toolkit & Monorepo Structure

## Package Manager

**pnpm workspace** - all commands use pnpm, not npm/yarn

```bash
# Root commands
pnpm install          # Install all workspace deps
pnpm build           # Build all packages
pnpm test            # Run all tests
pnpm watch           # Watch mode for all packages
pnpm clean           # Clean all build artifacts
```

## Monorepo Structure

```
packages/
├── lib/             # Core TypeScript library (Phase 1 focus)
├── node/            # Network node service (future phases)
└── notifier/        # Client applications (future phases)
```

**Current development:** Everything happens in `packages/lib/`

## Dev Tools

- **Biome**: Linting + formatting (`pnpm lint`, `pnpm format`)
- **Lefthook**: Git hooks for quality checks
- **Commitizen**: Structured commit messages (`pnpm commit`)
- **TypeScript**: Strict mode, Node 22+ required
- **Vite**: Build tool for the library

## CLI Development

```bash
cd packages/lib
pnpm build           # Build before running CLI
pnpm start           # Run the CLI interactively
```

## Key Files

- `pnpm-workspace.yaml` - Workspace config
- `biome.json` - Linting/formatting rules
- `lefthook.yml` - Git hooks
- `commitlint.config.js` - Commit message rules

Package-specific configs in each `packages/*/` directory.
