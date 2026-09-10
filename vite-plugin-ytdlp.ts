import {
  cacheKey,
  contentType,
  fetchClip,
  fetching,
  fetchProgress,
  hasYtdlp,
  isFetchable,
  seconds,
} from './scripts/serve/ytdlp.ts'

import type { Plugin } from 'vite'

import { createReadStream, statSync } from 'node:fs'

// The dev server's half of the yt-dlp bridge. The download, the cache and the
// progress readings live in `scripts/serve/ytdlp.ts`, which the binary's
// `serve` command mounts the same way, so what is left here is the connect-
// shaped glue and the tag that tells the app the bridge is up.
export function ytdlp(): Plugin {
  return {
    name: 'videoskillet.js-ytdlp',
    apply: 'serve',
    // The app reads this tag to decide whether to offer the video-URL source
    // (`src/sources/bridge.ts`). A tag rather than a build-time flag, because
    // the same production bundle is served by `videoskillet serve`, which has
    // the bridge, and by videoskillet.com, which does not — and a dev machine
    // with no yt-dlp installed has no more of a bridge than the website does.
    async transformIndexHtml() {
      return (await hasYtdlp())
        ? [
            {
              tag: 'meta',
              attrs: { name: 'videoskillet-bridge', content: 'ytdlp' },
              injectTo: 'head' as const,
            },
          ]
        : []
    },
    configureServer(server) {
      // Connect strips the '/yt' mount, so req.url here is '/?url=...' for the
      // clip and '/progress?url=...' for the stream that says how it is going.
      server.middlewares.use('/yt', (req, res) => {
        const asked = new URL(req.url ?? '', 'http://localhost')
        const target = asked.searchParams.get('url') ?? ''
        const secs = seconds(asked.searchParams.get('secs'))
        if (!isFetchable(target)) {
          res.statusCode = 400
          res.end('not an http(s) URL')
        } else if (asked.pathname === '/progress') {
          // Server-sent events rather than a poll: the client opens this
          // alongside the fetch it has already started and closes it when that
          // settles, so the stream never has to decide on its own that a
          // download it cannot see yet is one that is never coming.
          res.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-store',
            connection: 'keep-alive',
          })
          const key = cacheKey(target, secs)
          let last = ''
          const timer = setInterval(() => {
            const state = fetching.get(key)
            const line =
              state === undefined ? '' : JSON.stringify(fetchProgress(state))
            if (line !== '' && line !== last) {
              last = line
              res.write(`data: ${line}\n\n`)
            }
          }, 250)
          req.on('close', () => clearInterval(timer))
        } else {
          server.config.logger.info(
            `[yt-dlp] ${target}${secs === 0 ? '' : ` (first ${secs}s)`}`,
          )
          fetchClip(target, secs).then(
            file => {
              res.writeHead(200, {
                'content-type': contentType(file),
                'content-length': String(statSync(file).size),
                'cache-control': 'no-store',
              })
              createReadStream(file).pipe(res)
            },
            (e: unknown) => {
              res.statusCode = 502
              res.end(`yt-dlp: ${e instanceof Error ? e.message : String(e)}`)
            },
          )
        }
      })
    },
  }
}
