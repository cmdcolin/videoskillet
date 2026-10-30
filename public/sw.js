// The service worker, which exists for two reasons: an installed app has to
// open when the network does not, and Chrome will not offer to install one
// without a fetch handler here.
//
// Not bundled — a plain file in public/, so its URL is stable and its scope is
// the deploy root. src/registerSW.ts registers it relative to the page
// (src/publicUrl.ts), so the scope follows wherever the pages are.
//
// The build writes a hash of its asset names into BUILD (scripts/swstamp.mjs),
// which changes this file's bytes whenever the assets change. The browser then
// installs the new worker, and the new worker fills a cache of its own. Every
// file under assets/ is content-hashed, so one cache name kept for every
// release would hold every release's assets forever.

const BUILD = 'dev'
const CACHE = `videoskillet-${BUILD}`
// Where a file arriving from the OS share sheet is parked. Its own cache rather
// than a key in the one above, so clearing the app's assets on an upgrade never
// takes a file someone is in the middle of sending with it.
const SHARE = 'videoskillet-share'
const SHARE_KEY = 'shared-media'

// The cold-start floor: enough for the instrument and the camera to open
// offline before the hashed bundle has been seen once. The bundle itself lands
// in the same cache the first time it is fetched.
const SHELL = [
  'app/',
  'cam/',
  'manifest.webmanifest',
  'cam/manifest.webmanifest',
  'favicon.svg',
  'icon-192.png',
]

const shellUrl = name => new URL(name, self.registration.scope).href

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL.map(shellUrl)))
      .catch(err => {
        console.warn('[sw] shell precache skipped', err)
      }),
  )
})

// Keeps this build's cache, the share cache, and the most recent generation
// before this one. A tab opened before the deploy is still running the
// previous build's chunks, and the previous cache is where it finds the ones it
// has not loaded yet. `caches.keys()` lists caches in the order they were
// created, so the last of the others is the previous generation.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => {
        const older = keys.filter(k => k !== CACHE && k !== SHARE)
        return Promise.all(older.slice(0, -1).map(k => caches.delete(k)))
      })
      .then(() => self.clients.claim()),
  )
})

// Android hands a shared file over as a POST, and a page cannot read its own
// POST body — so the worker takes delivery, parks the file where the app can
// fetch it, and sends the browser on to a page that knows to look.
//
// 303 and not 302: the redirect has to turn the POST into a GET, or the app
// would be asked for at an address the server has never been POSTed at.
const receiveShare = async request => {
  const form = await request.formData()
  const file = form.get('media')
  if (file instanceof File) {
    const cache = await caches.open(SHARE)
    await cache.put(
      shellUrl(SHARE_KEY),
      new Response(file, {
        headers: {
          'content-type':
            file.type === '' ? 'application/octet-stream' : file.type,
          // Header values are latin-1, and a shared file is named by whatever
          // wrote it — a phone camera's date stamp, someone's kanji.
          'x-share-name': encodeURIComponent(file.name),
        },
      }),
    )
  }
  return Response.redirect(shellUrl('app/?shared=1'), 303)
}

const putIfOk = (key, response) => {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone()
    caches
      .open(CACHE)
      .then(cache => cache.put(key, copy))
      .catch(err => {
        console.warn('[sw] cache put failed', err)
      })
  }
  return response
}

// This build's cache first. `caches.match` searches every cache in the order
// they were created, so on its own it answers from the previous generation
// before this one.
const lookup = async (key, options) =>
  (await (await caches.open(CACHE)).match(key, options)) ??
  (await caches.match(key, options))

// A page is stored under its address without the query. Every page is the same
// document whatever the query says, and an old `?p=` link would otherwise add
// an entry of its own.
const pageKey = url => {
  const { origin, pathname } = new URL(url)
  return origin + pathname
}

// Fresh page, cached page if the network is gone, and the app's own shell if
// the address asked for was never visited — the shape every offline launch of
// an installed app takes. The camera installs as an app of its own, so an
// address under it falls back to the camera. `ignoreSearch` finds the pages a
// worker before pageKey stored under their full address.
const navigate = async request => {
  const page = pageKey(request.url)
  try {
    return putIfOk(page, await fetch(request))
  } catch (err) {
    const hit = await lookup(page, { ignoreSearch: true })
    const home = page.startsWith(shellUrl('cam/')) ? 'cam/' : 'app/'
    return hit ?? (await lookup(shellUrl(home))) ?? Promise.reject(err)
  }
}

// Everything under assets/ is content-hashed, so a hit in any generation is
// the file that was asked for and can be served without a revalidation
// round-trip. A hit from an older generation is copied into this one, because a
// chunk that survives a deploy unchanged keeps its name, and its only copy
// would go when the older cache does.
const immutable = async request => {
  const own = await (await caches.open(CACHE)).match(request)
  return (
    own ??
    putIfOk(request, (await caches.match(request)) ?? (await fetch(request)))
  )
}

const revalidating = async request => {
  const hit = await lookup(request)
  const live = fetch(request)
    .then(response => putIfOk(request, response))
    .catch(err => hit ?? Promise.reject(err))
  return hit ?? live
}

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin
  // Range requests are the video clips seeking. A cache hit answers a range
  // with the whole file and a 200, which Safari treats as a broken response, so
  // media never goes through here — nor would caching a 6 MB demo reel be a
  // kindness to anyone's storage quota.
  const media =
    request.headers.has('range') || /\.(mp4|webm)$/.test(url.pathname)
  // `videoskillet serve` mounts the yt-dlp bridge at /yt, and a fetch from it
  // is a whole clip — tens of megabytes, named by a query string rather than a
  // path, and already cached on the machine that downloaded it. Caching it here
  // would keep a second copy in the browser's quota to save a local read.
  const bridge = url.pathname === '/yt' || url.pathname.startsWith('/yt/')
  const share = url.pathname.endsWith('/app/share')
  if (request.method === 'POST' && sameOrigin && share) {
    event.respondWith(receiveShare(request))
  } else if (request.method === 'GET' && sameOrigin && !media && !bridge) {
    if (request.mode === 'navigate') {
      event.respondWith(navigate(request))
    } else if (url.pathname.includes('/assets/')) {
      event.respondWith(immutable(request))
    } else {
      event.respondWith(revalidating(request))
    }
  }
})
