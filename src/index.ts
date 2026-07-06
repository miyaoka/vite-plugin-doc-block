import type { Plugin, Rolldown } from 'vite'
import fsp from 'node:fs/promises'
import { parse } from 'vue/compiler-sfc'

// Regexes used by Vite's dependency scan (rolldown scan).
// The scan bypasses the normal plugin pipeline, so we need to perform
// the same import extraction as the built-in loader ourselves.
// https://github.com/vitejs/vite/blob/v8.1.3/packages/vite/src/node/optimizer/scan.ts
const importsRE
  = /(?<!\/\/.*)(?<=^|;|\*\/)\s*import(?!\s+type)(?:[\w*{}\n\r\t, ]+from)?\s*("[^"]+"|'[^']+')\s*(?=$|;|\/\/|\/\*)/gm
const multilineCommentsRE = /\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g
const singlelineCommentsRE = /\/\/.*/g

/**
 * TS transpilation drops imports that look unused (e.g. components only
 * referenced in the template), which halts the dependency crawl. Re-inject
 * every import path as a side-effect import to keep crawling.
 * Equivalent to extractImportPaths in Vite's built-in scan.
 */
function extractImportPaths(code: string): string {
  const stripped = code
    .replace(multilineCommentsRE, '/* */')
    .replace(singlelineCommentsRE, '')

  let js = ''
  importsRE.lastIndex = 0
  for (const match of stripped.matchAll(importsRE)) {
    js += `\nimport ${match[1]}`
  }
  return js
}

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
 */
function docBlockScanPlugin(): Rolldown.Plugin {
  return {
    name: 'vite-plugin-doc-block:scan',
    load: {
      filter: { id: /\.vue$/ },
      async handler(id) {
        const code = await fsp.readFile(id, 'utf-8')
        const { descriptor } = parse(code, { filename: id })

        if (!descriptor.customBlocks.some(block => block.type === 'doc')) {
          return
        }

        // <script> and <script setup> can coexist. Vue guarantees they
        // share the same lang, so it can be taken from either one
        const scriptBlocks = [descriptor.script, descriptor.scriptSetup].filter(
          block => block !== null,
        )
        const lang = scriptBlocks.find(block => block.lang !== undefined)?.lang
        const moduleType
          = lang === 'ts' || lang === 'tsx' || lang === 'jsx' ? lang : 'js'

        let js = ''
        for (const block of scriptBlocks) {
          if (block.src !== undefined) {
            js += `import ${JSON.stringify(block.src)}\n`
            continue
          }
          js += `${block.content}\n`
        }

        if (moduleType === 'ts' || moduleType === 'tsx') {
          js += extractImportPaths(js)
        }

        // A normal <script> already has export default; avoid duplicating it
        // (same guard as Vite's built-in scan)
        if (!js.includes('export default')) {
          js += '\nexport default {}'
        }

        return { code: js, moduleType }
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

      const docBlocks = descriptor.customBlocks.filter(
        block => block.type === 'doc',
      )

      if (docBlocks.length === 0) {
        return
      }

      let result = code

      for (const block of docBlocks) {
        const blockContent = code.slice(
          block.loc.start.offset,
          block.loc.end.offset,
        )
        result = result.replace(blockContent, '')
      }

      return {
        code: result,
        map: null,
      }
    },
  }
}
