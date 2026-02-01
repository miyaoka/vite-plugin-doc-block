import type { Plugin } from "vite";
import { parse } from "vue/compiler-sfc";

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
    name: "vite-plugin-doc-block",
    enforce: "pre",
    transform(code: string, id: string) {
      if (!id.endsWith(".vue")) {
        return;
      }

      const { descriptor } = parse(code, { filename: id });

      const docBlocks = descriptor.customBlocks.filter(
        (block) => block.type === "doc"
      );

      if (docBlocks.length === 0) {
        return;
      }

      let result = code;

      for (const block of docBlocks) {
        const blockContent = code.slice(
          block.loc.start.offset,
          block.loc.end.offset
        );
        result = result.replace(blockContent, "");
      }

      return {
        code: result,
        map: null,
      };
    },
  };
}
