import { describe, expect, it } from 'vitest'

import { parseSessionParams } from './urlParams'
import { hasSnow, withSnow } from './useUrlState'

const LINK = 'https://videoskillet.com/app/#p=mD.FbQ&mod='

describe('withSnow', () => {
  it('arms and strips the burst without touching the look', () => {
    const armed = withSnow(LINK, 1.5)
    expect(hasSnow(armed)).toBe(true)
    expect(parseSessionParams(armed.slice(armed.indexOf('#') + 1)).snow).toBe(
      1.5,
    )
    expect(withSnow(armed, null)).toBe(LINK)
  })

  it('re-arms rather than accumulating', () => {
    expect(withSnow(withSnow(LINK, 1.5), 3)).toBe(withSnow(LINK, 3))
  })

  it('reads a link that carries no params at all', () => {
    expect(hasSnow('https://videoskillet.com/app/')).toBe(false)
    expect(withSnow('https://videoskillet.com/app/', null)).toBe(
      'https://videoskillet.com/app/',
    )
    expect(withSnow('https://videoskillet.com/app/', 2)).toBe(
      'https://videoskillet.com/app/#snow=2',
    )
  })
})
