import { describe, expect, it } from 'vitest'

import { assetPath, byteRange, mimeFor, withBridgeTag } from './static'

// The server hands back whatever this maps a request onto, so what it refuses
// is the whole of the file-system guard.
describe('assetPath', () => {
  it('maps a directory onto its index page', () => {
    expect(assetPath('/')).toBe('index.html')
    expect(assetPath('/app/')).toBe('app/index.html')
  })

  it('maps a file onto itself, without the leading slash', () => {
    expect(assetPath('/app/index.html')).toBe('app/index.html')
    expect(assetPath('/assets/app-a1b2.js')).toBe('assets/app-a1b2.js')
    expect(assetPath('/sample.jpg')).toBe('sample.jpg')
  })

  it('decodes before it judges, so an escaped traversal is still one', () => {
    expect(assetPath('/%2e%2e/%2e%2e/etc/passwd')).toBeNull()
    expect(assetPath('/app/%2e%2e%2f%2e%2e%2fetc/passwd')).toBeNull()
  })

  it('refuses a traversal wherever in the path it sits', () => {
    expect(assetPath('/../secret')).toBeNull()
    expect(assetPath('/app/../../secret')).toBeNull()
    expect(assetPath('/assets/x/../../../etc/passwd')).toBeNull()
  })

  it('refuses what only a filesystem would read as a path', () => {
    expect(assetPath('/app\\..\\secret')).toBeNull()
    expect(assetPath('/app/x%00.html')).toBeNull()
    expect(assetPath('/%zz')).toBeNull()
  })

  it('keeps a name that merely contains dots', () => {
    expect(assetPath('/app/..well-known.txt')).toBe('app/..well-known.txt')
    expect(assetPath('/demo-v2.mp4')).toBe('demo-v2.mp4')
  })
})

describe('mimeFor', () => {
  it('names the types the app is served as', () => {
    expect(mimeFor('app/index.html')).toBe('text/html; charset=utf-8')
    expect(mimeFor('assets/app-a1b2.js')).toBe('text/javascript; charset=utf-8')
    expect(mimeFor('manifest.webmanifest')).toBe('application/manifest+json')
    expect(mimeFor('test.mp4')).toBe('video/mp4')
  })

  it('falls back rather than guessing', () => {
    expect(mimeFor('CNAME')).toBe('application/octet-stream')
  })
})

// The tag is how the app learns the server has yt-dlp behind it, and a module
// script reads it during evaluation — so it has to be in the head, ahead of the
// bundle.
describe('withBridgeTag', () => {
  it('puts the tag first inside the head', () => {
    const out = withBridgeTag('<html><head><title>x</title></head></html>')
    expect(out).toContain('<head><meta name="videoskillet-bridge"')
    expect(out.indexOf('videoskillet-bridge')).toBeLessThan(
      out.indexOf('<title>'),
    )
  })

  it('leaves a document with no head alone', () => {
    expect(withBridgeTag('<p>hi</p>')).toBe('<p>hi</p>')
  })
})

// What a <video> asks for when it seeks. Everything else reads as no range,
// which the whole file is a correct answer to.
describe('byteRange', () => {
  it('reads a bounded range', () => {
    expect(byteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(byteRange('bytes=200-299', 1000)).toEqual({ start: 200, end: 299 })
  })

  it('runs an open-ended range to the last byte', () => {
    expect(byteRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 })
  })

  it('reads a suffix range as the tail, not the head', () => {
    expect(byteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(byteRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 })
  })

  it('clamps an end past the file', () => {
    expect(byteRange('bytes=500-99999', 1000)).toEqual({ start: 500, end: 999 })
  })

  it('declines what it will not answer in parts', () => {
    expect(byteRange(null, 1000)).toBeNull()
    expect(byteRange('bytes=0-99,200-299', 1000)).toBeNull()
    expect(byteRange('items=0-99', 1000)).toBeNull()
    expect(byteRange('bytes=-', 1000)).toBeNull()
    expect(byteRange('bytes=1000-', 1000)).toBeNull()
    expect(byteRange('bytes=500-100', 1000)).toBeNull()
    expect(byteRange('bytes=0-99', 0)).toBeNull()
  })
})
