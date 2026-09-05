import { unified } from '@astrojs/markdown-remark'
import { defineConfig } from 'astro/config'
import rehypeRaw from 'rehype-raw'

import { rehypeGuide } from './site/lib/rehype-guide.mjs'
import { remarkGuide } from './site/lib/remark-guide.mjs'

import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
      server.middlewares.use((req, _res, next) => {
        // Dev routes have no extension; the pages link to each other by
        // filename because that is what the build emits.
        req.url = req.url.replace(/\.html(?=$|[?#])/, '')
        next()
      })
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
  // Flat `*.html` in one directory, laid out the way the pages directory is.
  // `scripts/guidecheck.mjs` reads the guide non-recursively, so nested pages
  // would go unchecked without saying so, and flat names are what let every
  // cross-link and figure stay relative. `file` would be the obvious setting
  // and is the wrong one: it renders a directory's index as `guide.html`
  // beside the directory rather than `guide/index.html` inside it.
  build: { format: 'preserve' },
  // Astro's HTML minifier strips whitespace-only text nodes between elements,
  // so `Built by\n<a>cmdcolin</a>.` renders as "Built bycmdcolin." and the
  // markup needs `{' '}` spacers to read as a sentence. Off, the browser
  // collapses the newline to the one space that was written; the bytes it
  // costs are nothing against a handful of static pages.
  compressHTML: false,
  integrations: [figures()],
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
