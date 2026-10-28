import { describe, expect, it } from 'vitest'

import { distFile } from './static.mjs'

describe('distFile', () => {
  it('maps a request onto a file under the root', () => {
    expect(distFile('/srv/dist', '/guide/index.html')).toBe(
      '/srv/dist/guide/index.html',
    )
    expect(distFile('/srv/dist', '/')).toBe('/srv/dist/')
  })

  it('refuses an escaped traversal', () => {
    expect(distFile('/srv/dist', '/..%2f..%2fetc/passwd')).toBeNull()
    expect(distFile('/srv/dist', '/%2e%2e/secret')).toBeNull()
    expect(distFile('/srv/dist', '/..%2fdist-other/x')).toBeNull()
  })

  it('refuses a path that does not decode', () => {
    expect(distFile('/srv/dist', '/%zz')).toBeNull()
  })
})
