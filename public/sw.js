// The service worker, which exists for two reasons: an installed app has to
// open when the network does not, and Chrome will not offer to install one
// without a fetch handler here.
//
// Not generated and not bundled — a plain file in public/, so its URL is stable
// and its scope is the deploy root. src/registerSW.ts registers it relative to
// the page for the same reason the rest of the app is: a build runs from any
// sub-path (vite.config.ts), and a hard-coded /sw.js would only ever be right
// on videoskillet.com.

const CACHE = 'videoskillet-v1'
// Where a file arriving from the OS share sheet is parked. Its own cache rather
// than a key in the one above, so clearing the app's assets on an upgrade never
// takes a file someone is in the middle of sending with it.
const SHARE = 'videoskillet-share'
const SHARE_KEY = 'shared-media'

// The cold-start floor: enough for the instrument to open offline before the
// hashed bundle has been seen once. The bundle itself lands in the same cache
// the first time it is fetched.
const SHELL = ['app/', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png']

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

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE && k !== SHARE)
            .map(k => caches.delete(k)),
        ),
      )
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

const putIfOk = (request, response) => {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone()
    caches
      .open(CACHE)
      .then(cache => cache.put(request, copy))
      .catch(err => {
        console.warn('[sw] cache put failed', err)
      })
  }
  return response
}

// Fresh page, cached page if the network is gone, and the instrument itself if
// the address asked for was never visited — the shape every offline launch of
// an installed app takes.
const navigate = async request => {
  try {
    return putIfOk(request, await fetch(request))
  } catch (err) {
    const hit = await caches.match(request, { ignoreSearch: true })
    return hit ?? (await caches.match(shellUrl('app/'))) ?? Promise.reject(err)
  }
}

// Everything under assets/ is content-hashed, so a hit is the file that was
// asked for and can be served without a revalidation round-trip.
const immutable = async request => {
  const hit = await caches.match(request)
  return hit ?? putIfOk(request, await fetch(request))
}

const revalidating = async request => {
  const hit = await caches.match(request)
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
  const share = url.pathname.endsWith('/app/share')
  if (request.method === 'POST' && sameOrigin && share) {
    event.respondWith(receiveShare(request))
  } else if (request.method === 'GET' && sameOrigin && !media) {
    if (request.mode === 'navigate') {
      event.respondWith(navigate(request))
    } else if (url.pathname.includes('/assets/')) {
      event.respondWith(immutable(request))
    } else {
      event.respondWith(revalidating(request))
    }
  }
})
