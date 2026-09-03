import type { Plugin } from 'vite'

import { readFileSync } from 'node:fs'

// The shaders are the most heavily commented text in the project and every byte
// of it shipped: `?raw` hands the file to the bundler as a string literal, so a
// comment written for a reader of `decode.wgsl` was downloaded by everyone who
// opened the app. Measured on the shared chunk every page loads — 780.6 kB raw
// / 265.8 kB gzipped down to 627.4 / 203.3, which is 62.5 kB gzipped, or a
// quarter of it, and none of it code.
//
// **The blank line stays.** A comment becomes an empty line rather than no line,
// so `createShaderModule`'s error rows still name the line the reader would
// count to in the file — which is the whole reason this can run in dev as well
// as in the build, and why what the browser compiles is the same text either
// way. The newlines cost 360 bytes raw and 113 gzipped against dropping them.
//
// Cutting at the first `//` is safe because WGSL has no string literal to hide
// one in and no block comment form in this codebase — every `//` in
// `src/core/gpu/shaders` is either a whole-line comment or a trailing one.
//
// Nothing past this is worth taking. Identifier mangling — the rest of what a
// minifier would do — is 24.9 kB gzipped down to 22.0 on the stripped corpus,
// and it cannot be done a file at a time anyway: `PRELUDE + src` is joined at
// **runtime** (pipeline.ts), so prelude and shader share one namespace that a
// per-file pass never sees whole.
export const stripWgslComments = (src: string): string =>
  src
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return (at === -1 ? line : line.slice(0, at)).trimEnd()
    })
    .join('\n')

// The prelude is WGSL that lives in a `.ts` file because its constants come
// from TypeScript, so the `?raw` path above never sees it. It is marked with
// the same `/* wgsl */` tag editors use to syntax-highlight the literal, which
// makes the tag load-bearing rather than decorative — a WGSL literal that loses
// it keeps its comments.
//
// The tag is matched without the space between it and the backtick as well as
// with: by the time a transform runs, the source has been through oxc's
// TypeScript pass, which reformats that gap.
const WGSL_LITERAL = /\/\*\s*wgsl\s*\*\/\s*`([\s\S]*?)`/g

export const stripWgslLiterals = (
  code: string,
): { code: string; hits: number } => {
  let hits = 0
  const out = code.replace(WGSL_LITERAL, (_match, body: string) => {
    hits++
    return `\`${stripWgslComments(body)}\``
  })
  return { code: out, hits }
}

// Files carrying a `/* wgsl */` literal. Named rather than matched across every
// module because the transform below throws when a listed file has no literal
// in it, and that check is what stops the tag from being renamed or lost
// quietly — a guess-based match would have nothing to be sure about.
const LITERAL_MODULES = ['src/core/gpu/prelude.ts']

export function wgsl(): Plugin {
  return {
    name: 'videoskillet:wgsl',
    enforce: 'pre',
    // A `load` rather than a `transform`: vite's own `?raw` load hook has
    // already wrapped the file in `export default "…"` by transform time, and
    // stripping *that* cuts the module off at the first `//` inside the string
    // — which builds clean, ships a chunk 150 kB lighter, and leaves the app
    // with 26 undefined shaders.
    load(id) {
      const [file, query] = id.split('?')
      if (!file.endsWith('.wgsl') || query !== 'raw') {
        return null
      }
      return `export default ${JSON.stringify(stripWgslComments(readFileSync(file, 'utf8')))}`
    },
    transform(code, id) {
      const file = id.split('?')[0]
      if (!LITERAL_MODULES.some(m => file.endsWith(m))) {
        return null
      }
      const { code: out, hits } = stripWgslLiterals(code)
      if (hits === 0) {
        throw new Error(
          `${file} is listed as carrying a /* wgsl */ literal and has none — retag it or drop it from LITERAL_MODULES`,
        )
      }
      return { code: out, map: null }
    },
  }
}
