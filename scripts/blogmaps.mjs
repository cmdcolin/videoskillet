#!/usr/bin/env node
import { createServer } from 'vite'

// Renders the app's signal chain map (src/ui/ChainMap.tsx) for a blog post's
// look into public/blog/<post>-map.svg. The map is the sidebar's own component,
// lit the way the sidebar lights it when the post's look link opens, so a post
// shows the reader the stages the link will touch. The SVG carries its own
// styles, with the dark theme's tokens written in as values, because the blog
// embeds it as an image.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const POSTS = [
  'better-scramble-channel',
  'oak-sigma-and-videocipher',
  'alpha-keying',
  'keyer-ghosts',
]

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(root, path), 'utf8')

const tokens = [
  'node_modules/skillet-shared/dist/tokens.css',
  'src/theme.css',
].flatMap(path =>
  [...read(path).matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map(m => [
    m[1],
    m[2],
  ]),
)
const tokenValue = new Map(tokens)
const resolve = text =>
  text.replace(/var\((--[a-z0-9-]+)\)/g, (whole, name) =>
    tokenValue.has(name) ? resolve(tokenValue.get(name)) : whole,
  )
const style = resolve(
  `svg { font-family: var(--font); }\n${read('src/ui/ChainMap.module.css')}`,
)

const lookOf = post => {
  const look = read(`site/posts/${post}.md`).match(/^look: '([^']+)'$/m)?.[1]
  if (look === undefined) throw new Error(`${post}.md has no look`)
  return look
}

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  css: { modules: { generateScopedName: '[local]' } },
})

const check = process.argv.includes('--check')
const stale = []
try {
  const { blogMapMarkup } = await server.ssrLoadModule('/src/ui/blogMap.tsx')
  for (const post of POSTS) {
    const markup = blogMapMarkup(lookOf(post))
    const [, w, h] = markup.match(/viewBox="0 0 (\d+) (\d+)"/) ?? []
    const svg = `${markup
      .replace(
        /^<svg /,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${Number(w) * 2}" height="${Number(h) * 2}" `,
      )
      .replace(/^(<svg[^>]*>)/, `$1<style>${style}</style>`)}\n`
    const out = join(root, 'public', 'blog', `${post}-map.svg`)
    if (check) {
      if (!existsSync(out) || readFileSync(out, 'utf8') !== svg) stale.push(out)
    } else {
      writeFileSync(out, svg)
      console.log(`wrote ${out}`)
    }
  }
} finally {
  await server.close()
}

if (stale.length > 0) {
  console.error(`stale, run \`pnpm blog:maps\`:\n  ${stale.join('\n  ')}`)
  process.exitCode = 1
} else if (check) {
  console.log('blog maps up to date')
}
