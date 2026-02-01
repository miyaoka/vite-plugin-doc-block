# CLAUDE.md

## Overview

Vite plugin that strips `<doc>` custom blocks from Vue SFC.

## Commands

```bash
pnpm install    # Install dependencies
pnpm build      # Build
pnpm dev        # Build in watch mode
```

## Structure

- `src/index.ts` - Plugin implementation
- `tsdown.config.ts` - Build configuration
- `dist/` - Build output (ESM + CJS)

## How it works

- Runs before vite-plugin-vue-inspector via `enforce: "pre"`
- Parses SFC using `vue/compiler-sfc`'s `parse`
- Finds blocks where `type === "doc"` in `customBlocks`
- Removes matching blocks via string replacement

## Release

```bash
pnpm build
npm publish
```
