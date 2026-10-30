import { describe, expect, it } from 'vitest'

import { buildId, stampWorker } from './swstamp.mjs'

import { readFileSync } from 'node:fs'

describe('buildId', () => {
  it('does not depend on the order the names were listed in', () => {
    expect(buildId(['b.2.js', 'a.1.js'])).toBe(buildId(['a.1.js', 'b.2.js']))
  })

  it('changes when an asset does', () => {
    expect(buildId(['a.1.js'])).not.toBe(buildId(['a.2.js']))
  })
})

describe('stampWorker', () => {
  it('stamps the shipped worker', () => {
    const source = readFileSync('public/sw.js', 'utf8')
    const stamped = stampWorker(source, 'abc123')
    expect(stamped).toContain("const BUILD = 'abc123'")
    expect(stamped).not.toContain("const BUILD = 'dev'")
  })

  it('refuses a worker with no placeholder', () => {
    expect(() => stampWorker("const CACHE = 'x'", 'abc123')).toThrow(
      /exactly once, found 0/,
    )
  })
})
