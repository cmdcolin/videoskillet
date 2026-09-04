import { expect, test } from 'vitest'

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Every asset the app names goes through `publicUrl`, and nothing checked that
// the file on the other end exists. One did not: the fatal screen postered its
// clip with `demos/wonkitize-me.jpg`, which has never been a file — the still
// beside it is a `.webp` — so the one screen a visitor without WebGPU ever sees
// showed a black box until its video decoded. A 404 in the network log is the
// only place that appeared.
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  )

const named = walk('src')
  .filter(file => !file.endsWith('publicUrl.ts'))
  .flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(/publicUrl\('([^']*)'\)/g)].map(
      match => ({ file, asset: match[1] }),
    ),
  )
  // `publicUrl('')` is the deploy root rather than a file.
  .filter(({ asset }) => asset !== '')

test('the app names assets through publicUrl', () => {
  expect(named.length).toBeGreaterThan(0)
})

test.each(named)('$asset exists in public/ ($file)', ({ asset }) => {
  expect(existsSync(`public/${asset}`)).toBe(true)
})
