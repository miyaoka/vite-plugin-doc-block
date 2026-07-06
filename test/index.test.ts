import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { docBlockPlugin } from '../src'

function fixturePath(name: string) {
  return path.join(import.meta.dirname, 'fixtures', name)
}

// Extract the load handler of the scan plugin injected by config()
function getScanLoadHandler() {
  const plugin = docBlockPlugin()
  const config = (plugin.config as unknown as () => {
    optimizeDeps: {
      rolldownOptions: {
        plugins: {
          load: {
            handler: (
              id: string,
            ) => Promise<{ code: string, moduleType: string } | undefined>
          }
        }[]
      }
    }
  })()
  return config.optimizeDeps.rolldownOptions.plugins[0].load.handler
}

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

describe('docBlockScanPlugin (dep scan)', () => {
  const load = getScanLoadHandler()

  it('returns script content for SFC with doc block containing literal <script>', async () => {
    const result = await load(fixturePath('doc-with-script-literal.vue'))

    // doc block content (including the literal <script>) is excluded
    expect(result?.code).not.toContain('never executed')
    // script setup content is preserved
    expect(result?.code).toContain(`import { ref } from 'vue'`)
    expect(result?.moduleType).toBe('ts')
    // guard against TS dropping unused imports: import paths are re-injected as side-effect imports
    expect(result?.code).toContain(`import './Child.vue'`)
  })

  it('does not duplicate export default for normal <script>', async () => {
    const result = await load(fixturePath('doc-with-default-export.vue'))

    const count = result?.code.match(/export default/g)?.length
    expect(count).toBe(1)
    expect(result?.moduleType).toBe('js')
  })

  it('returns undefined for SFC without doc block', async () => {
    const result = await load(fixturePath('no-doc.vue'))
    expect(result).toBeUndefined()
  })
})
