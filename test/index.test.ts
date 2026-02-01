import { describe, expect, it } from 'vitest'
import { docBlockPlugin } from '../src'

describe('docBlockPlugin', () => {
  const plugin = docBlockPlugin()
  const transform = plugin.transform as (
    code: string,
    id: string,
  ) => { code: string } | undefined

  it('removes <doc> block content', () => {
    const input = `<doc lang="md">
# Hello
</doc>

<script setup lang="ts">
const x = 1;
</script>

<template>
  <div>Hello</div>
</template>`

    const result = transform(input, 'test.vue')

    // Content inside <doc> is removed
    expect(result?.code).not.toContain('# Hello')
    // Other blocks remain
    expect(result?.code).toContain('<script')
    expect(result?.code).toContain('<template')
  })

  it('returns undefined for non-.vue files', () => {
    const result = transform('const x = 1', 'test.ts')
    expect(result).toBeUndefined()
  })

  it('returns undefined when no <doc> block', () => {
    const input = `<template><div>Hello</div></template>`
    const result = transform(input, 'test.vue')
    expect(result).toBeUndefined()
  })

  it('removes content from multiple <doc> blocks', () => {
    const input = `<doc>First</doc>
<doc>Second</doc>
<template><div>Hello</div></template>`

    const result = transform(input, 'test.vue')

    expect(result?.code).not.toContain('First')
    expect(result?.code).not.toContain('Second')
    expect(result?.code).toContain('<template')
  })

  it('removes HTML-like strings that would cause inspector errors', () => {
    const input = `<doc>
## Usage

Use <RouterView> for routing.
</doc>

<template><div>Hello</div></template>`

    const result = transform(input, 'test.vue')

    // This is the main use case: prevent vue-inspector from parsing HTML in docs
    expect(result?.code).not.toContain('<RouterView>')
  })
})
