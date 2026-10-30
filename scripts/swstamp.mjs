// Writes the build's id into the service worker the build copied out of
// public/. public/sw.js explains what the worker does with it.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PLACEHOLDER = "const BUILD = 'dev'"

// The asset names are content-hashed, so their sorted list identifies the
// build's code. A deploy that changes no asset keeps the same id, and the
// browser keeps the worker and the cache it already has.
export const buildId = names =>
  createHash('sha256')
    .update([...names].sort().join('\n'))
    .digest('hex')
    .slice(0, 12)

// Throws when the placeholder is missing. A worker shipped with BUILD still at
// 'dev' keeps one cache name across every release, which is the growth the
// stamp exists to stop.
export const stampWorker = (source, id) => {
  const parts = source.split(PLACEHOLDER)
  if (parts.length !== 2) {
    throw new Error(
      `sw.js must contain \`${PLACEHOLDER}\` exactly once, found ${parts.length - 1}`,
    )
  }
  return parts.join(`const BUILD = '${id}'`)
}

export const stampDist = dir => {
  const file = join(dir, 'sw.js')
  const id = buildId(readdirSync(join(dir, 'assets'), { recursive: true }))
  writeFileSync(file, stampWorker(readFileSync(file, 'utf8'), id))
  return id
}
