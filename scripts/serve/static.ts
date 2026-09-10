// The static half of `videoskillet serve`, as plain functions over strings.
//
// Nothing here touches a runtime API, which is what lets the awkward parts —
// where a URL path lands on disk, what a range header means, where the bridge
// tag goes — be tested without a server or a browser in the room.

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  wasm: 'application/wasm',
  webmanifest: 'application/manifest+json',
  woff2: 'font/woff2',
}

export const mimeFor = (path: string): string => {
  const dot = path.lastIndexOf('.')
  const ext = dot === -1 ? '' : path.slice(dot + 1).toLowerCase()
  return TYPES[ext] ?? 'application/octet-stream'
}

// Where a request lands inside the served directory, as a relative path, or
// null for anything that must not be answered from disk.
//
// The rejections are the point. A path is decoded first, because `%2e%2e%2f` is
// the same request as `../` and only one of the two is obvious; then every
// segment is checked, so a traversal is refused wherever in the path it sits
// rather than only at the front. A backslash is refused outright: it separates
// directories on Windows, where the binary also runs, and nothing the app asks
// for contains one.
export const assetPath = (pathname: string): string | null => {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('\\') || decoded.includes('\0')) return null
  const parts = decoded.split('/').filter(p => p !== '' && p !== '.')
  if (parts.some(p => p === '..')) return null
  // A directory is its index page, which is how `/app/` reaches the instrument
  // and `/` the landing page.
  return decoded.endsWith('/') || parts.length === 0
    ? [...parts, 'index.html'].join('/')
    : parts.join('/')
}

// What the app is told the server can do. The video-URL source is backed by
// yt-dlp, which is a program on the host rather than anything the page can
// reach on its own, so the page has to be told — see `src/sources/bridge.ts`,
// which reads this tag, and `vite-plugin-ytdlp.ts`, which writes the same one
// on the dev server.
export const BRIDGE_TAG = '<meta name="videoskillet-bridge" content="ytdlp">'

// Straight after `<head>`, so the tag is in the document before any module
// script runs and a synchronous read of it during module evaluation finds it.
// An HTML file with no head is handed back untouched rather than guessed at.
export const withBridgeTag = (html: string): string => {
  const head = html.indexOf('<head>')
  return head === -1
    ? html
    : `${html.slice(0, head + 6)}${BRIDGE_TAG}${html.slice(head + 6)}`
}

// A byte range off a `Range` header, clamped to the file. Only the single-range
// `bytes=` form, which is what a <video> element asks for; anything else reads
// as no range at all and the whole file goes back, which is a valid answer to
// any request.
export const byteRange = (
  header: string | null,
  size: number,
): { start: number; end: number } | null => {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '')
  if (m === null || size === 0) return null
  const [, from, to] = m
  if (from === '' && to === '') return null
  // A suffix range — `bytes=-500` — is the last 500 bytes, not the first.
  const start = from === '' ? Math.max(0, size - Number(to)) : Number(from)
  const end =
    from === '' || to === '' ? size - 1 : Math.min(Number(to), size - 1)
  return start > end || start >= size ? null : { start, end }
}
