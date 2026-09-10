// What the server behind this page can do that the page cannot.
//
// The video-URL source fetches a clip with yt-dlp, which is a program on a
// machine. The same production bundle runs in three places and only two of them
// have one: `videoskillet serve` out of the binary, a vite dev server with the
// yt-dlp plugin, and videoskillet.com, which is files on a CDN with nothing
// behind them to run. So the server says so in the document it serves — a
// `<meta name="videoskillet-bridge">` tag — and the app offers the source only
// when the tag is there.
//
// Read synchronously while the module evaluates, which is why it is a tag
// rather than an endpoint to ask: a module script runs after the head is
// parsed, so the answer is already in the document, and the source lists
// (`modes.ts`) stay plain constants instead of growing a loading state for one
// option.
//
// The content is a space-separated list, read the way `class` is: one tag can
// name several bridges, and a server that grows a second one adds a word.
export const hasBridge = (name: string): boolean => {
  if (typeof document === 'undefined') return false
  const tags = document.querySelectorAll('meta[name="videoskillet-bridge"]')
  return [...tags].some(tag =>
    (tag.getAttribute('content') ?? '').split(/\s+/).includes(name),
  )
}
