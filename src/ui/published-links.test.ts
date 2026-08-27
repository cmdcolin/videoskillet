import { expect, test } from 'vitest'

import { SLIDER_BY_KEY } from './controls'
import { unpackControls } from './packed'
import { parseSessionParams } from './urlParams'

import type { ControlKey } from '../core/controls'

import { readFileSync } from 'node:fs'

// The links the project hands strangers: four demos in the README and the hero
// patch at the top of the getting-started page. They are packed, which is what
// took them from 400-950 characters to 130-230 — and packed means nobody
// proofreads them again. A typo in one, or a paste that lost its tail, decodes
// to a shorter look rather than to an error, so the demo would still open and
// still look like *something*.
//
// This is the cheap check that it is the something it was: the bytes are a real
// look, of about the size the demo has, with every value inside the control it
// names. What it deliberately does not do is pin the looks themselves — the
// format is pinned in packed.test.ts, and a second copy of these forty controls
// here would be a thing to update rather than a thing to read.
const links = (path: string): string[] =>
  [
    ...readFileSync(path, 'utf8').matchAll(/https:\/\/\S*?\?(p=\S+?)[)\s]/g),
  ].map(m => m[1])

const published = [
  ...links('README.md').map(q => ['README.md', q] as const),
  ...links('docs/GETTING-STARTED.md').map(
    q => ['docs/GETTING-STARTED.md', q] as const,
  ),
]

test('the project publishes the links it means to', () => {
  expect(published.length).toBe(5)
})

test.each(published)('%s: %s', (_page, query) => {
  const packed = new URLSearchParams(query).get('p') ?? ''
  const look = unpackControls(packed)

  // A demo moves a good part of the panel; a mangled link decodes to a handful.
  expect(Object.keys(look).length).toBeGreaterThan(15)

  for (const [key, v] of Object.entries(look)) {
    const def = SLIDER_BY_KEY.get(key as ControlKey)
    expect({ key, inRange: v >= def!.min && v <= def!.max }).toEqual({
      key,
      inRange: true,
    })
  }

  // and the whole query is a look the loader will take, not a first arrival
  expect(parseSessionParams(`?${query}`).controls).toEqual(look)
})
