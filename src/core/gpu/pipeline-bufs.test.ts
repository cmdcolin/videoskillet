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
