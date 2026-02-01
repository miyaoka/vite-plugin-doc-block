# vite-plugin-doc-block

Vite plugin to strip `<doc>` custom blocks from Vue SFC.

Write documentation directly in your Vue components. The plugin removes them during build, so they don't affect bundle size.

## Install

```bash
pnpm add -D vite-plugin-doc-block
```

## Usage

```ts
// vite.config.ts
import vue from "@vitejs/plugin-vue";
import { docBlockPlugin } from "vite-plugin-doc-block";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [docBlockPlugin(), vue()],
});
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
const props = defineProps<{ userId: string }>();
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

## License

MIT
