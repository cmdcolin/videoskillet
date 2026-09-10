// The app, served from the binary, with the yt-dlp bridge behind it.
//
//   videoskillet serve
//   videoskillet serve --port=9000 --open
//
// **Why the binary hosts a web server.** The instrument is a web app and the
// hosted copy at videoskillet.com is the whole thing — except for one source.
// The video-URL option shells out to yt-dlp, which is a program on a machine,
// so a page served from a CDN can never offer it: there is nothing on the other
// end to run. Until now that source existed only on a dev server, behind a
// clone, a pnpm install and a vite plugin. Here the same bridge is mounted by
// the binary somebody downloaded, and the app it serves is the same production
// build the website is.
//
// The static files are compiled into the executable (`--include`, see
// `scripts/render/compile.mjs`), so `serve` needs no checkout and no network —
// what it needs is yt-dlp on PATH, and it says so at startup when there is
// none. Everything else the app does, it already did offline.

import { assetPath, byteRange, mimeFor, withBridgeTag } from './static.ts'
import {
  cacheKey,
  contentType,
  fetchClip,
  fetching,
  fetchProgress,
  hasYtdlp,
  isFetchable,
  seconds,
} from './ytdlp.ts'

import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const flag = (name: string): string | undefined => {
  const hit = Deno.args.find(a => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}
const has = (name: string): boolean => Deno.args.includes(`--${name}`)

if (has('help')) {
  console.log(
    `videoskillet serve — the app, hosted from this binary.

  serve [options]

  --port=<n>      which port to listen on (default 8787)
  --host=<addr>   which address to bind (default 127.0.0.1, this machine only)
  --dir=<path>    serve a build from disk instead of the embedded one
  --open          open the app in the default browser once the server is up

The app served here is the production build, and it behaves as the hosted one
does with one addition: the video-URL source, which fetches a clip from any
site yt-dlp has an extractor for. That source is the reason to run this rather
than open videoskillet.com — it needs yt-dlp on the machine, so a page served
from a CDN cannot offer it.

yt-dlp has to be on PATH for that source to appear. Nothing else here needs it,
and the rest of the app runs with no network at all.`,
  )
  Deno.exit(0)
}

const port = Number(flag('port') ?? 8787)
const hostname = flag('host') ?? '127.0.0.1'

// The app's files. Compiled into the binary, where this resolves inside the
// executable's own filesystem; the same path in a clone is the real `dist/`,
// which is what makes `pnpm render serve` serve the build sitting there.
const dir = flag('dir')
const root =
  dir === undefined
    ? new URL('../../dist/', import.meta.url)
    : pathToFileURL(`${resolve(dir)}/`)

// The buffer is retyped rather than copied: `Response` takes a view over an
// ArrayBuffer and `readFile` is typed over the shared one as well, which is a
// distinction with nothing behind it here — nothing shares this.
const readAsset = async (
  rel: string,
): Promise<Uint8Array<ArrayBuffer> | null> => {
  try {
    return (await Deno.readFile(new URL(rel, root))) as Uint8Array<ArrayBuffer>
  } catch {
    return null
  }
}

if ((await readAsset('app/index.html')) === null) {
  console.error(
    `no app build under ${root.pathname} — run \`pnpm build\`, or point --dir at a build`,
  )
  Deno.exit(1)
}

const bridged = await hasYtdlp()
if (!bridged) {
  console.error(
    'note: yt-dlp is not on PATH, so the video-URL source is not offered. Install it to fetch clips by address.',
  )
}

const text = (body: string, status: number): Response =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })

// The bridge, in the shape Deno hands requests over in. The download, the
// cache and the progress readings are `ytdlp.ts`'s and are the dev server's
// too — only this transport is new.
const bridge = async (url: URL): Promise<Response> => {
  const target = url.searchParams.get('url') ?? ''
  const secs = seconds(url.searchParams.get('secs'))
  if (!bridged) return text('yt-dlp is not installed on this machine', 501)
  if (!isFetchable(target)) return text('not an http(s) URL', 400)

  if (url.pathname === '/yt/progress') {
    // Server-sent events rather than a poll: the client opens this alongside
    // the fetch it has already started and closes it when that settles, so the
    // stream never has to decide on its own that a download it cannot see yet
    // is one that is never coming.
    const key = cacheKey(target, secs)
    let timer: ReturnType<typeof setInterval>
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        let last = ''
        timer = setInterval(() => {
          const state = fetching.get(key)
          const line =
            state === undefined ? '' : JSON.stringify(fetchProgress(state))
          if (line !== '' && line !== last) {
            last = line
            controller.enqueue(encoder.encode(`data: ${line}\n\n`))
          }
        }, 250)
      },
      cancel() {
        clearInterval(timer)
      },
    })
    return new Response(body, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
      },
    })
  }

  console.error(`[yt-dlp] ${target}${secs === 0 ? '' : ` (first ${secs}s)`}`)
  try {
    // Streamed off disk rather than read into memory: a clip is tens of
    // megabytes, and the response is the file.
    const file = await fetchClip(target, secs)
    const handle = await Deno.open(file, { read: true })
    return new Response(handle.readable, {
      headers: {
        'content-type': contentType(file),
        'content-length': String(statSync(file).size),
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    return text(`yt-dlp: ${e instanceof Error ? e.message : String(e)}`, 502)
  }
}

const serveAsset = async (req: Request, url: URL): Promise<Response> => {
  const rel = assetPath(url.pathname)
  if (rel === null) return text('bad path', 400)

  const body = await readAsset(rel)
  // The landing page and the guide are the website's and are not carried here,
  // so the root goes where somebody running this wants to be anyway.
  if (body === null) {
    return rel === 'index.html'
      ? Response.redirect(new URL('/app/', url), 302)
      : text('not found', 404)
  }

  if (rel.endsWith('.html')) {
    const html = new TextDecoder().decode(body)
    return new Response(bridged ? withBridgeTag(html) : html, {
      headers: { 'content-type': mimeFor(rel), 'cache-control': 'no-store' },
    })
  }

  const range = byteRange(req.headers.get('range'), body.length)
  const headers: Record<string, string> = {
    'content-type': mimeFor(rel),
    'accept-ranges': 'bytes',
    // Nothing is cached: a build served here is replaced by the next `serve`
    // of a different one, and every asset under `assets/` is content-hashed
    // anyway, so there is nothing to gain and a stale file to lose.
    'cache-control': 'no-store',
  }
  if (range === null) {
    return new Response(body, { headers })
  }
  return new Response(body.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      ...headers,
      'content-range': `bytes ${range.start}-${range.end}/${body.length}`,
    },
  })
}

// `onListen` is silenced because the line it prints names the root, and the
// address worth clicking is the instrument one directory down.
const server = Deno.serve({ port, hostname, onListen: () => {} }, req => {
  const url = new URL(req.url)
  return url.pathname === '/yt' || url.pathname === '/yt/progress'
    ? bridge(url)
    : serveAsset(req, url)
})

const at = `http://${hostname}:${port}/app/`
console.error(`videoskillet — ${at}`)

if (has('open')) {
  const opener =
    Deno.build.os === 'darwin'
      ? ['open', at]
      : Deno.build.os === 'windows'
        ? ['cmd', '/c', 'start', '', at]
        : ['xdg-open', at]
  try {
    new Deno.Command(opener[0], { args: opener.slice(1) }).spawn()
  } catch {
    // A machine with no opener is not a failed server; the address is printed.
  }
}

await server.finished
