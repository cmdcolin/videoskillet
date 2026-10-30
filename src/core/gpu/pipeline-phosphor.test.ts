import { expect, test } from 'vitest'

import { readFileSync } from 'node:fs'

const source = readFileSync('src/core/gpu/pipeline.ts', 'utf8')

// Decode reads the phosphor state out of one buffer and writes it into the
// other, so each decode has to read what the one before it wrote. `endTake`
// rewinds `frame` by the length of the take, and a pick keyed off its parity
// read the state from two frames back after any take of odd length.

test('the phosphor ping-pong is picked off its own flip, not the frame counter', () => {
  const picks = [...source.matchAll(/this\.decodeBgs\[([^\]]+)\]/g)]
    .map(m => m[1])
    .filter(i => i !== '0')
  expect(picks).toEqual(['this.phosphorSide'])
  expect(source).not.toMatch(/this\.frame\s*(?:%\s*2|&\s*1)\b/)
})

test('the flip turns over once per submitted frame, right after the submit', () => {
  const turns = [...source.matchAll(/this\.phosphorSide = (.+)$/gm)].map(
    m => m[1],
  )
  expect(turns).toHaveLength(2)
  expect(turns).toEqual(
    expect.arrayContaining(['0', 'this.phosphorSide === 0 ? 1 : 0']),
  )
  expect(source).toMatch(
    /d\.queue\.submit\(\[enc\.finish\(\)\]\)\n\s*this\.phosphorSide = this\.phosphorSide === 0 \? 1 : 0\n/,
  )
})
