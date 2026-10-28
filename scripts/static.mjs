// Serves a built `dist/` the way Pages serves it: a directory answers with the
// `index.html` inside it, and anything missing answers 404 rather than being
// rewritten into something that works. Shared by `distcheck.mjs`, which reads
// the answers, and `guidecheck.mjs`, which needs the pages over http at all —
// every link and figure in the guide is site-absolute, so a page opened over
// `file://` looks for `/guide/img/…` at the root of the filesystem.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

// Only what the site actually serves. An extension missing here arrives as
// application/octet-stream, which a browser declines rather than renders — so a
// new asset type is a line in this table, not a mystery.
const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
}

// The file a request names under `root`, or null for a path that does not
// decode or that resolves outside it.
export const distFile = (root, pathname) => {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const base = resolve(root)
  const file = join(base, decoded)
  return file === base || file.startsWith(base + sep) ? file : null
}

export const serveDist = (root, port) => {
  const server = createServer((req, res) => {
    const asked = new URL(req.url ?? '/', 'http://dist')
    let file = distFile(root, asked.pathname)
    if (file === null) {
      res.writeHead(400)
      res.end(`bad path ${asked.pathname}`)
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      file = join(file, 'index.html')
    }
    if (existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      })
      res.end(readFileSync(file))
    } else {
      res.writeHead(404)
      res.end(`no ${asked.pathname} in ${root}`)
    }
  })
  return new Promise(done =>
    server.listen(port, '127.0.0.1', () => done(server)),
  )
}
