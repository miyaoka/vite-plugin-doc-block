# @miyaoka/vite-plugin-doc-block

[![npm version](https://img.shields.io/npm/v/@miyaoka/vite-plugin-doc-block)](https://www.npmjs.com/package/@miyaoka/vite-plugin-doc-block)
[![npm downloads](https://img.shields.io/npm/dm/@miyaoka/vite-plugin-doc-block)](https://www.npmjs.com/package/@miyaoka/vite-plugin-doc-block)
[![license](https://img.shields.io/npm/l/@miyaoka/vite-plugin-doc-block)](https://github.com/miyaoka/vite-plugin-doc-block/blob/main/LICENSE)

Vite plugin to strip `<doc>` custom blocks from Vue SFC.

Write documentation directly in your Vue components. The plugin removes them during build, so they don't affect bundle size.

## Install

```bash
pnpm add -D @miyaoka/vite-plugin-doc-block
```

## Usage

```ts
// vite.config.ts
import { docBlockPlugin } from '@miyaoka/vite-plugin-doc-block'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [docBlockPlugin(), vue()],
})
```

> **Note**: Place `docBlockPlugin()` before other Vue-related plugins.
> This plugin must run before `vite-plugin-vue-inspector` (used by `vite-plugin-vue-devtools`),
> which would error when parsing HTML-like strings (e.g. `<RouterView>`) inside `<doc>` blocks.

Then you can write `<doc>` blocks in your Vue components:

```vue
<doc lang="md">
# MyComponent

This component displays user information.

## Props

- `userId` - The user ID to display

## Usage

Used in the user profile page.
</doc>

<script setup lang="ts">
const props = defineProps<{ userId: string }>()
</script>

<template>
  <div>{{ user.name }}</div>
</template>
```

The `<doc>` block will be removed during build.

## Why

- **Colocation**: Keep documentation next to the code it describes
- **Zero runtime cost**: Stripped at build time
- **IDE friendly**: Documentation is visible when editing the component

## Why not a simpler approach?

A common approach to ignore custom blocks is to return an empty module:

```ts
// This does NOT work with vite-plugin-vue-inspector
const vueDocsPlugin = {
  name: 'vue-docs',
  transform(_code, id) {
    if (!/vue&type=doc/.test(id))
      return
    return `export default ''`
  },
}
```

However, this doesn't solve the `vite-plugin-vue-inspector` issue. The inspector parses the SFC before this transform runs, and HTML-like strings inside `<doc>` blocks (e.g. `<RouterView>`) cause parsing errors.

This plugin uses `enforce: 'pre'` to run before the inspector and removes the content from the SFC source directly, preventing the error.

## License

MIT
