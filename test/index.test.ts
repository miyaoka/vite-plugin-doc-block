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

  it('exposes script content via a virtual block module, excluding doc content', async () => {
    const id = fixturePath('doc-with-script-literal.vue')
    const stub = await load(id)

    // doc block content (including the literal <script>) is excluded
    expect(stub?.code).not.toContain('never executed')
    expect(stub?.code).toContain(`export * from`)
    expect(stub?.code).toContain('export default {}')

    const block = await load(`${id}?doc-block-scan.0.ts`)
    expect(block?.moduleType).toBe('ts')
    expect(block?.code).not.toContain('never executed')
    // script setup content is preserved
    expect(block?.code).toContain(`import { ref } from 'vue'`)
    // guard against TS dropping unused imports: import paths are re-injected as side-effect imports
    expect(block?.code).toContain(`import './Child.vue'`)
  })

  it('keeps <script> and <script setup> in separate block modules', async () => {
    const id = fixturePath('doc-with-both-scripts.vue')
    const stub = await load(id)

    // both blocks may declare identical bindings (Vue dedupes them when
    // merging), so one concatenated module would be a duplicate-declaration
    // error — each block must load as its own module
    expect(stub?.code).toContain(`?doc-block-scan.0.ts`)
    expect(stub?.code).toContain(`?doc-block-scan.1.ts`)

    const script = await load(`${id}?doc-block-scan.0.ts`)
    expect(script?.code).toContain(`import { computed } from 'vue'`)
    expect(script?.code).toContain('export default')

    const scriptSetup = await load(`${id}?doc-block-scan.1.ts`)
    expect(scriptSetup?.code).toContain(`import { computed } from 'vue'`)
    expect(scriptSetup?.code).toContain('computed(() => 1)')
  })

  it('keeps a component export default out of the stub module', async () => {
    const id = fixturePath('doc-with-default-export.vue')
    const stub = await load(id)

    const count = stub?.code.match(/export default/g)?.length
    expect(count).toBe(1)
    expect(stub?.moduleType).toBe('js')

    const block = await load(`${id}?doc-block-scan.0.js`)
    expect(block?.moduleType).toBe('js')
    expect(block?.code).toContain('defineComponent')
  })

  it('returns undefined for SFC without doc block', async () => {
    const result = await load(fixturePath('no-doc.vue'))
    expect(result).toBeUndefined()
  })
})
