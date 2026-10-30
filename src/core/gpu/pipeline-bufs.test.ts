import { expect, test } from 'vitest'

import { readFileSync } from 'node:fs'

const source = readFileSync('src/core/gpu/pipeline.ts', 'utf8')

const body = (name: string) => {
  const start = source.indexOf(`private ${name}(): GPUBuffer[] {`)
  expect(start).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf('\n  }\n', start))
}

test('destroy releases every GPUBuffer field the engine declares', () => {
  const fields = [
    ...source.matchAll(
      /^ {2}private (\w+): (?:GPUBuffer|\[GPUBuffer, GPUBuffer\])$/gm,
    ),
  ].map(m => m[1]!)
  expect(fields.length).toBeGreaterThan(20)
  const listed = body('allBufs') + body('stateBufs')
  const missing = fields.filter(f => !listed.includes(`this.${f}`))
  expect(missing).toEqual([])
})

// A copy out of a buffer created without COPY_SRC fails validation, and the
// whole frame's command buffer goes with it: the screen stops updating and
// nothing in the signal path is wrong.
test('every buffer the engine copies out of is created with COPY_SRC', () => {
  const sources = new Set(
    [...source.matchAll(/copyBufferToBuffer\(\s*this\.(\w+),/g)].map(
      m => m[1]!,
    ),
  )
  expect(sources.size).toBeGreaterThan(2)
  const creation = (name: string) => {
    const lines = source.split('\n')
    const start = lines.findIndex(l => l.startsWith(`    this.${name} = `))
    expect(start, `this.${name} is never assigned`).toBeGreaterThan(-1)
    const rest = lines.slice(start + 1)
    const end = rest.findIndex(l => !l.startsWith('      ') && l !== '    })')
    return [lines[start], ...rest.slice(0, end)].join('\n')
  }
  const missing = [...sources].filter(s => !creation(s).includes('COPY_SRC'))
  expect(missing).toEqual([])
})
