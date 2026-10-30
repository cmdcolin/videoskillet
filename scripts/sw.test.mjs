import { describe, expect, it } from 'vitest'

import { stampWorker } from './swstamp.mjs'

import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const ORIGIN = 'https://videoskillet.test'
const at = path => `${ORIGIN}${path}`

const urlOf = request => (typeof request === 'string' ? request : request.url)
const keyOf = (request, ignoreSearch) => {
  const url = new URL(urlOf(request))
  return ignoreSearch ? url.origin + url.pathname : url.href
}

const body = text => ({
  ok: true,
  type: 'basic',
  text,
  clone: () => body(text),
})

class FakeCache {
  entries = new Map()

  async put(request, response) {
    this.entries.set(keyOf(request, false), response)
  }

  async match(request, options) {
    const ignoreSearch = options?.ignoreSearch === true
    const want = keyOf(request, ignoreSearch)
    const found = [...this.entries].find(
      ([key]) => keyOf(key, ignoreSearch) === want,
    )
    return found?.[1]
  }

  async addAll(urls) {
    for (const url of urls) this.entries.set(url, body(url))
  }
}

// CacheStorage keeps its caches in the order they were created, and `match`
// searches them in that order.
const fakeCaches = names => {
  const named = new Map(names.map(name => [name, new FakeCache()]))
  return {
    named,
    open: async name => {
      if (!named.has(name)) named.set(name, new FakeCache())
      return named.get(name)
    },
    keys: async () => [...named.keys()],
    delete: async name => named.delete(name),
    match: async (request, options) => {
      const hits = await Promise.all(
        [...named.values()].map(cache => cache.match(request, options)),
      )
      return hits.find(hit => hit !== undefined)
    },
  }
}

const offline = async () => {
  throw new TypeError('NetworkError')
}

const boot = ({ build, caches, fetch }) => {
  const listeners = new Map()
  const self = {
    registration: { scope: at('/') },
    location: { origin: ORIGIN },
    addEventListener: (type, listener) => listeners.set(type, listener),
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
  }
  const source = stampWorker(readFileSync('public/sw.js', 'utf8'), build)
  runInNewContext(source, { self, caches, fetch, URL, File, console })
  return {
    activate: async () => {
      const waits = []
      listeners.get('activate')({ waitUntil: wait => waits.push(wait) })
      await Promise.all(waits)
    },
    get: async (path, mode) => {
      const answers = []
      listeners.get('fetch')({
        request: { url: at(path), method: 'GET', mode, headers: new Headers() },
        respondWith: answer => answers.push(answer),
      })
      const response = await answers[0]
      await new Promise(resolve => setTimeout(resolve, 0))
      return response
    },
  }
}

describe('service worker', () => {
  it('keeps this build, the previous build and the share cache on activate', async () => {
    const caches = fakeCaches([
      'videoskillet-v1',
      'videoskillet-aaa',
      'videoskillet-share',
      'videoskillet-bbb',
    ])
    await boot({ build: 'bbb', caches, fetch: offline }).activate()
    expect(await caches.keys()).toEqual([
      'videoskillet-aaa',
      'videoskillet-share',
      'videoskillet-bbb',
    ])
  })

  it('stores a page once whatever its query', async () => {
    const caches = fakeCaches(['videoskillet-bbb'])
    const fetch = async request => body(request.url)
    const worker = boot({ build: 'bbb', caches, fetch })
    await worker.get('/app/?p=one', 'navigate')
    await worker.get('/app/?p=two', 'navigate')
    const pages = caches.named.get('videoskillet-bbb').entries
    expect([...pages.keys()]).toEqual([at('/app/')])
    expect(pages.get(at('/app/')).text).toBe(at('/app/?p=two'))
  })

  it('answers an offline navigation with a query from the stored page', async () => {
    const caches = fakeCaches(['videoskillet-bbb'])
    await caches.named.get('videoskillet-bbb').put(at('/app/'), body('app'))
    const worker = boot({ build: 'bbb', caches, fetch: offline })
    expect((await worker.get('/app/?p=one', 'navigate')).text).toBe('app')
  })

  it('finds a page the previous worker stored under its full address', async () => {
    const caches = fakeCaches(['videoskillet-v1', 'videoskillet-bbb'])
    await caches.named.get('videoskillet-v1').put(at('/cam/?x=1'), body('cam'))
    const worker = boot({ build: 'bbb', caches, fetch: offline })
    expect((await worker.get('/cam/', 'navigate')).text).toBe('cam')
  })

  it('prefers this build over the previous one for a revalidated file', async () => {
    const caches = fakeCaches(['videoskillet-aaa', 'videoskillet-bbb'])
    const file = at('/manifest.webmanifest')
    await caches.named.get('videoskillet-aaa').put(file, body('old'))
    await caches.named.get('videoskillet-bbb').put(file, body('new'))
    const worker = boot({ build: 'bbb', caches, fetch: offline })
    expect((await worker.get('/manifest.webmanifest', 'cors')).text).toBe('new')
  })

  it("serves the previous build's chunk to a tab still running it", async () => {
    const caches = fakeCaches(['videoskillet-aaa', 'videoskillet-bbb'])
    const chunk = at('/assets/old.1234.js')
    await caches.named.get('videoskillet-aaa').put(chunk, body('chunk'))
    const worker = boot({ build: 'bbb', caches, fetch: offline })
    expect((await worker.get('/assets/old.1234.js', 'cors')).text).toBe('chunk')
  })

  it("copies the previous build's chunk into this build's cache", async () => {
    const caches = fakeCaches(['videoskillet-aaa', 'videoskillet-bbb'])
    const chunk = at('/assets/kept.1234.js')
    await caches.named.get('videoskillet-aaa').put(chunk, body('chunk'))
    const worker = boot({ build: 'bbb', caches, fetch: offline })
    await worker.get('/assets/kept.1234.js', 'cors')
    const own = caches.named.get('videoskillet-bbb').entries
    expect(own.get(chunk)?.text).toBe('chunk')
  })
})
