import type { Plugin, Rolldown } from 'vite'
import fsp from 'node:fs/promises'
import { parse } from 'vue/compiler-sfc'

// Regexes used by Vite's dependency scan (rolldown scan).
// The scan bypasses the normal plugin pipeline, so we need to perform
// the same import extraction as the built-in loader ourselves.
// https://github.com/vitejs/vite/blob/v8.1.3/packages/vite/src/node/optimizer/scan.ts
const importsRE =
  /(?<!\/\/.*)(?<=^|;|\*\/)\s*import(?!\s+type)(?:[\w*{}\n\r\t, ]+from)?\s*("[^"]+"|'[^']+')\s*(?=$|;|\/\/|\/\*)/gm
const multilineCommentsRE = /\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g
const singlelineCommentsRE = /\/\/.*/g

/**
 * TS transpilation drops imports that look unused (e.g. components only
 * referenced in the template), which halts the dependency crawl. Re-inject
 * every import path as a side-effect import to keep crawling.
 * Equivalent to extractImportPaths in Vite's built-in scan.
 */
function extractImportPaths(code: string): string {
  const stripped = code.replace(multilineCommentsRE, '/* */').replace(singlelineCommentsRE, '')

  let js = ''
  importsRE.lastIndex = 0
  for (const match of stripped.matchAll(importsRE)) {
    js += `\nimport ${match[1]}`
  }
  return js
}

// Virtual module id suffix for per-script-block modules. The id ends with a
// JS extension (e.g. `Foo.vue?doc-block-scan.0.ts`) so that Vite's built-in
// scan transform (`vite:dep-scan:transform:js-glob`, gated by JS_TYPES_RE)
// still processes import.meta.glob inside the block contents.
const scanBlockIdRE = /\?doc-block-scan\.\d+\.\w+$/
const scanLoadFilterRE = /(?:\.vue|\?doc-block-scan\.\d+\.\w+)$/

/**
 * Rolldown plugin used only during Vite's dependency scan.
 *
 * The scan uses config plugins for resolveId only; .vue files are read
 * from disk by the built-in loader, which extracts <script> with a regex.
 * A literal `<script>` inside a doc block is misdetected as an opening tag,
 * causing a parse error (dependency pre-bundling gets skipped).
 *
 * Plugins passed to optimizeDeps.rolldownOptions.plugins have their load
 * hook called before the built-in scan plugins (first-non-null-wins), so
 * for SFCs containing doc blocks we extract scripts with the real SFC
 * parser instead. Without a doc block, return undefined to defer to
 * Vite's standard path.
 *
 * Each script block becomes its own virtual module (same design as Vite's
 * built-in scan loader): <script> and <script setup> can legitimately
 * declare the same bindings (compileScript dedupes imports when merging),
 * so concatenating them into one module would raise duplicate-declaration
 * errors and abort the whole scan.
 */
function docBlockScanPlugin(): Rolldown.Plugin {
  // Per-block contents keyed by virtual module id. Populated when the owning
  // .vue file is loaded, which always happens before the block ids resolve
  const blockContents = new Map<string, { code: string; moduleType: string }>()

  return {
    name: 'vite-plugin-doc-block:scan',
    resolveId: {
      filter: { id: scanBlockIdRE },
      handler: (id) => ({ id }),
    },
    load: {
      filter: { id: scanLoadFilterRE },
      async handler(id) {
        const blockModule = blockContents.get(id)
        if (blockModule) {
          return blockModule
        }
        if (!id.endsWith('.vue')) {
          return
        }

        const code = await fsp.readFile(id, 'utf-8')
        // Cheap gate before the full SFC parse; false positives just fall
        // through to the customBlocks check
        if (!code.includes('<doc')) {
          return
        }
        const { descriptor } = parse(code, { filename: id })

        if (!descriptor.customBlocks.some((block) => block.type === 'doc')) {
          return
        }

        const scriptBlocks = [descriptor.script, descriptor.scriptSetup].filter(
          (block) => block !== null,
        )

        let stub = ''
        let index = 0
        for (const block of scriptBlocks) {
          if (block.src !== undefined) {
            stub += `import ${JSON.stringify(block.src)}\n`
            continue
          }

          const { lang } = block
          const moduleType = lang === 'ts' || lang === 'tsx' || lang === 'jsx' ? lang : 'js'
          let contents = block.content
          if (moduleType === 'ts' || moduleType === 'tsx') {
            contents += extractImportPaths(contents)
          }

          const blockId = `${id}?doc-block-scan.${index}.${moduleType}`
          index += 1
          blockContents.set(blockId, { code: contents, moduleType })
          // export * does not re-export default, so the stub's own
          // `export default {}` below never conflicts with a block's one
          stub += `export * from ${JSON.stringify(blockId)}\n`
        }

        stub += 'export default {}'
        return { code: stub, moduleType: 'js' }
      },
    },
  }
}

/**
 * Vite plugin to strip <doc> custom blocks from Vue SFC.
 *
 * The <doc> block allows you to write documentation directly in your Vue components.
 * This plugin removes them during build, so they don't affect bundle size.
 *
 * @example
 * ```vue
 * <doc lang="md">
 * # MyComponent
 *
 * This component does something useful.
 * </doc>
 *
 * <template>
 *   <div>...</div>
 * </template>
 * ```
 */
export function docBlockPlugin(): Plugin {
  return {
    name: 'vite-plugin-doc-block',
    enforce: 'pre',
    config() {
      return {
        optimizeDeps: {
          rolldownOptions: {
            plugins: [docBlockScanPlugin()],
          },
        },
      }
    },
    transform(code: string, id: string) {
      if (!id.endsWith('.vue')) {
        return
      }

      const { descriptor } = parse(code, { filename: id })

      const docBlocks = descriptor.customBlocks.filter((block) => block.type === 'doc')

      if (docBlocks.length === 0) {
        return
      }

      let result = code

      for (const block of docBlocks) {
        const blockContent = code.slice(block.loc.start.offset, block.loc.end.offset)
        result = result.replace(blockContent, '')
      }

      return {
        code: result,
        map: null,
      }
    },
  }
}
