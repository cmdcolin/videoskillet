import { expect, test } from 'vitest'

import { SLIDER_BY_KEY } from './controls'
import { packControls, unpackControls } from './packed'
import { parseSessionParams } from './urlParams'

import type { ControlKey } from '../core/controls'

import { readFileSync } from 'node:fs'

// The links the project hands strangers: every demo in the README, which is
// generated from `demos.json` and so is all of them — two used to be published
// pointing at a dev server, which is the sort of thing that stops happening
// when the origin is not stored per demo. The getting-started page carried the
// hero patch until it was rewritten and now carries none, but it is still read
// here so that one added back is covered.
// They are packed, which is what took them from 400-950 characters to 130-230 —
// and packed means nobody proofreads them again. A typo in one, or a paste that
// lost its tail, decodes to a shorter look rather than to an error, so the demo
// would still open and still look like *something*.
//
// This is the cheap check that it is the something it was: the bytes re-pack to
// the link they came from, they are a look rather than a knob, and every value
// is inside the control it names. What it deliberately does not do is pin the
// looks themselves — the format is pinned in packed.test.ts, and a second copy
// of these forty controls here would be a thing to update rather than a thing
// to read.
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
  expect(published.length).toBe(12)
})

test.each(published)('%s: %s', (_page, query) => {
  const packed = new URLSearchParams(query).get('p') ?? ''
  const decoded = unpackControls(packed)
  // Sealed, so a mistyped one is refused outright rather than read short.
  expect(decoded).not.toBe(null)
  const look = decoded === null ? {} : decoded

  // Re-packing what it decoded has to give the link back. The decoder is
  // deliberately lenient — it stops at the first short read and keeps what it
  // had, which is what lets an old build open a newer link — so a lost tail
  // decodes to a prefix rather than to an error. That prefix re-packs shorter
  // than the link, and a typo'd character throws the varint stream out of step;
  // both fail here. What it cannot see is a cut landing on a byte boundary and
  // a field boundary at once — measured on the shortest demo, three truncation
  // lengths in four are caught and the fourth is not — which is the part the
  // floor below is left holding.
  expect(packControls(look)).toBe(packed)

  // A demo is a look, not one knob. The floor sits well under the narrowest
  // published demo (the feedback-only patch moves fifteen) because a demo is
  // allowed to be a single group of the panel; it is here to catch an empty or
  // gutted link, not to police how large a demo has to be.
  expect(Object.keys(look).length).toBeGreaterThan(10)

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
