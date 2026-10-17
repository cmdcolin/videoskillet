import { unified } from '@astrojs/markdown-remark'
import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import rehypeRaw from 'rehype-raw'

import pkg from './package.json' with { type: 'json' }
import { rehypeGuide } from './site/lib/rehype-guide.mjs'
import { remarkGuide } from './site/lib/remark-guide.mjs'
import { wgsl } from './vite-plugin-wgsl.ts'
import { ytdlp } from './vite-plugin-ytdlp.ts'

import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

const FIGURES = 'docs/img'

const TYPES = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

// The figures stay at `/guide/img/<name>`, copied flat rather than handed to
// Astro's asset pipeline. Two things depend on the literal path: the landing
// page loads `signal-path-callout.jpg` from it directly, and `shots.json` joins
// a figure to the app session that produced it on the bare filename.
const figures = () => ({
  name: 'guide-figures',
  hooks: {
    'astro:server:setup': ({ server }) => {
      // Vite strips the base before middlewares run, so the path arrives here
      // as `/img/…` rather than `/guide/img/…`.
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent(
          new URL(req.url, 'http://guide').pathname,
        )
        const name = /^(?:\/guide)?\/img\/(.+)$/.exec(path)
        const file = name === null ? undefined : join(FIGURES, name[1])
        const type = file === undefined ? undefined : TYPES[extname(file)]
        if (type === undefined || !file.startsWith(`${FIGURES}/`)) {
          next()
        } else {
          res.writeHead(200, {
            'content-type': type,
            'cache-control': 'no-store',
          })
          res.end(readFileSync(file))
        }
      })
    },
    'astro:build:done': ({ dir }) => {
      const out = join(fileURLToPath(dir), 'guide', 'img')
      mkdirSync(out, { recursive: true })
      for (const file of readdirSync(FIGURES)) {
        copyFileSync(join(FIGURES, file), join(out, file))
      }
    },
  },
})

export default defineConfig({
  site: 'https://videoskillet.com',
  srcDir: './site',
  // Astro owns the site root, so it builds first and vite adds the three app
  // entries to what it left (vite.config.ts).
  outDir: './dist',
  publicDir: './public',
  // A page is a directory with an index inside it, so it is read at
  // `/guide/faq/` and every link the site writes ends in a slash. `preserve`
  // emitted `faq.html` and put that filename in the address bar. The slugs stay
  // flat (`adr-0004-…`), so every page is one level deep and the figures are at
  // `/guide/img/` from all of them.
  // `assets` rather than `_astro`: `scripts/render/compile.mjs` bundles
  // `dist/assets` into the `serve` binary.
  build: { format: 'directory', assets: 'assets' },
  // Astro's HTML minifier strips whitespace-only text nodes between elements,
  // so `Built by\n<a>cmdcolin</a>.` renders as "Built bycmdcolin." and the
  // markup needs `{' '}` spacers to read as a sentence. Off, the browser
  // collapses the newline to the one space that was written; the bytes it
  // costs are nothing against a handful of static pages.
  compressHTML: false,
  integrations: [
    figures(),
    react({
      compiler: {
        logDiagnostics: true,
        reportDiagnostics: true,
        eslintSuppressionRules: [],
      },
    }),
  ],
  server: { port: 5199 },
  vite: {
    plugins: [wgsl(), ytdlp()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __GIT_SHA__: JSON.stringify(gitSha()),
    },
    server: {
      // forwardConsole relays console.* through the dev server, which reports
      // each message at the patch site rather than where it was logged; the
      // render loop's diagnostics are console breadcrumbs.
      forwardConsole: false,
      // Astro restarts on any changed file named `astro.config.*`, and agent
      // worktrees under `.claude/` each hold a copy.
      watch: {
        ignored: [fileURLToPath(new URL('.claude/**', import.meta.url))],
      },
    },
  },
  markdown: {
    // `build-guide.mjs` emitted plain <pre>, styled by the guide's own palette.
    // Astro's highlighter paints its own near-black background over that.
    syntaxHighlight: false,
    processor: unified({
      // The docs are written with straight quotes and literal em dashes. Astro
      // turns smartypants on by default, which would rewrite the punctuation of
      // every one of them on the way through.
      smartypants: false,
      remarkPlugins: [remarkGuide],
      // The diagrams and the figures are raw HTML in the markdown. rehype-raw
      // parses it into the tree, which is what lets the transforms below be
      // structural rather than regexes over a string of HTML.
      rehypePlugins: [rehypeRaw, rehypeGuide],
      remarkRehype: { allowDangerousHtml: true },
    }),
  },
})
