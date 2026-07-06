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
- Injects a scan-only plugin into `optimizeDeps.rolldownOptions.plugins` via the `config` hook (#330). Vite's dependency scan bypasses the plugin pipeline and regex-extracts `<script>` from raw files, so a literal `<script>` inside a doc block breaks the scan. For SFCs with doc blocks, the scan plugin parses them with the real SFC parser and exposes each script block as its own virtual module — same design as Vite's built-in scan loader (Vite 8+ only; esbuild-based Vite 5–7 ignores the option)

## Release

```bash
pnpm build
npm publish
```
