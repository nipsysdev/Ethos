# Monorepo Setup and Tooling

## Overview

The Ethos project uses a monorepo structure managed by Lerna, with PNPM as the package manager. This setup allows for efficient management of multiple packages while maintaining consistent tooling and dependencies across the project.

## Monorepo Structure

The monorepo is organized into packages:

- `packages/lib`: Shared library code
- `packages/node`: Node.js specific implementations
- `packages/notifier`: Notification system

Each package is managed independently but shares common tooling and dependencies through the root configuration.

## Tooling

### Package Management

- **PNPM**: Used for dependency management with a single `pnpm-lock.yaml` file
- **Lerna**: Manages monorepo operations including:
  - `bootstrap`: Install dependencies and link packages
  - `build`: Build all packages
  - `watch`: Watch for changes across packages
  - `clean`: Remove node_modules from all packages

### Code Quality

- **Biome**: Handles linting and formatting with configuration in `biome.json`
  - Formatter: Enabled with tab indentation
  - Linter: Uses recommended rules
  - JavaScript: Double quotes for strings
  - Import organization: Automatically organizes imports

### Git Workflow

- **Lefthook**: Manages git hooks (currently in template stage)
- **Commitizen**: Standardizes commit messages

## Development Workflow

1. Install dependencies: `pnpm install`
2. Bootstrap packages: `pnpm run bootstrap`
3. Start development: `pnpm run watch`
4. Lint code: `pnpm run lint`
5. Format code: `pnpm run format`
6. Build project: `pnpm run build`

## Best Practices

- Keep shared dependencies in the root `package.json`
- Use Lerna commands for cross-package operations
- Run linting and formatting before committing
- Follow conventional commits with Commitizen
