/**
 * Node loader that patches a Vocs bug at module-load time on Windows.
 *
 * `recmaMdxLayout` (vocs/dist/internal/mdx.js) interpolates the page's
 * `path.relative()` result straight into a JS string literal:
 *
 *   filePath: "${filePath}",
 *
 * On Windows that result contains backslashes, so a nested page like
 * `testing/unit-tests.md` becomes `"testing\unit-tests.md"`. Acorn then fails
 * with `Bad character escape sequence` (`\u` + `nit-tests`), and the build
 * aborts before any page is generated. The same interpolation also silently
 * drops separators for other nested pages (`ui\antd.md` -> `uiantd.md`).
 *
 * Rewriting to `JSON.stringify(filePath)` escapes the separators correctly.
 * Kept as a loader (instead of a pnpm patch) so the workaround stays inside
 * packages/docs and Linux builds run Vocs untouched; remove once Vocs ships a
 * fix upstream.
 */

// biome-ignore lint/suspicious/noTemplateCurlyInString: mirrors the Vocs source text verbatim
const TARGET = 'filePath: "${filePath}",';
// biome-ignore lint/suspicious/noTemplateCurlyInString: this is the JS code emitted into the module
const PATCHED = 'filePath: ${JSON.stringify(filePath)},';
const MDX_MODULE_SUFFIX = '/vocs/dist/internal/mdx.js';

/** @type {import('node:module').LoadHook} */
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  // `source` is a string or a Buffer depending on how the entry was resolved.
  if (!url.endsWith(MDX_MODULE_SUFFIX) || result.source == null) return result;
  const source = String(result.source);
  // Leave the module untouched if a future Vocs version changes or fixes this.
  if (!source.includes(TARGET)) return result;
  return {
    ...result,
    source: source.replace(TARGET, PATCHED),
    shortCircuit: true,
  };
}
