// Does a take's file sink behave the way `takeSink.ts` says it does?
//
//   node scripts/sinkcheck.mjs [port]
//
// The unit tests cover the Blob sink, which is ordinary code. The file sink is
// browser semantics all the way down — a writable that buffers into a swap
// file and commits on close, a positional write that patches bytes already
// written, a directory that can be iterated and removed out of — and none of
// that is testable anywhere but in a browser.
//
// What it pins, in order: the sink opens at all; the picture lands with the
// head patched in over the bytes it reserved; an abandoned take leaves no
// file; a finished take's file is left for the download to read; and the next
// page's sweep clears it once it is old enough.
//
// Secure-context only, so it runs against the app on localhost.

import { launchFirefox } from './browser.mjs'
import { appUp } from './until.mjs'

import process from 'node:process'

const port = process.argv[2] ?? '5199'

const fail = []
const check = (name, ok, detail = '') => {
  console.log(
    `${ok ? '  ok' : 'FAIL'}  ${name}${detail === '' ? '' : ` — ${detail}`}`,
  )
  if (!ok) fail.push(name)
}

const browser = await launchFirefox()
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
await page.goto(`http://localhost:${port}/app/`, {
  waitUntil: 'domcontentloaded',
})
await appUp(page, 6000)

const got = await page.evaluate(async () => {
  const { fileSink, blobSink, sweepTakes } = await import('/src/ui/takeSink.ts')
  const { STREAM_HEAD } = await import('/src/ui/mp4.ts')

  // How many take files the origin is holding.
  const held = async () => {
    const root = await navigator.storage.getDirectory()
    try {
      const dir = await root.getDirectoryHandle('takes', { create: false })
      let n = 0
      for await (const _ of dir.keys()) n++
      return n
    } catch {
      return 0
    }
  }

  const { quota = 0, usage = 0 } = await navigator.storage.estimate()
  // What the sink should offer: the grant less the room it keeps back for
  // finishing a take and for the rest of the app.
  const out = {
    before: await held(),
    quota,
    grant: Math.max(0, quota - usage - 256 * 1024 * 1024),
  }

  // A whole take, in miniature: reserve, write the picture, then hand over the
  // layout either side of it.
  const head = new Uint8Array(STREAM_HEAD).fill(0xc0)
  const sink = await fileSink()
  out.opened = sink !== null
  if (sink === null) return out
  out.streamed = sink.streamed
  out.room = sink.room()
  sink.write(new Uint8Array(4).fill(1))
  sink.write(new Uint8Array(6).fill(2))
  out.spent = out.room - sink.room()
  const file = await sink.close({
    head,
    tail: [new Uint8Array(2).fill(9)],
  })
  out.size = file.size
  out.type = file.type
  const bytes = new Uint8Array(await file.arrayBuffer())
  out.headPatched = bytes.slice(0, STREAM_HEAD).every(b => b === 0xc0)
  out.picture = Array.from(bytes.slice(STREAM_HEAD))
  out.heldAfterClose = await held()

  // An abandoned take: the file goes, and nothing is left for a sweep to find.
  const doomed = await fileSink()
  doomed.write(new Uint8Array(8).fill(3))
  doomed.discard()
  await new Promise(r => setTimeout(r, 300))
  out.heldAfterDiscard = await held()

  // The sweep leaves a take alone while a download could still be reading it,
  // and clears it once it is old enough. `now` is the only way to say "later"
  // without waiting ten minutes.
  out.sweptFresh = await sweepTakes(Date.now())
  out.heldAfterFreshSweep = await held()
  out.sweptStale = await sweepTakes(Date.now() + 11 * 60 * 1000)
  out.heldAfterStaleSweep = await held()

  // The fallback, which every browser without `createWritable` gets.
  const blob = blobSink()
  const fell = await blob.close({ head, tail: [new Uint8Array(2).fill(9)] })
  out.blobStreamed = blob.streamed
  out.blobType = fell.type

  return out
})
await browser.close()

console.log(got)

check('the file sink opens', got.opened === true)
check('and says it is streaming', got.streamed === true)
check(
  'it spends its room on the picture',
  got.spent === 10,
  `${got.spent} bytes`,
)
// What a take may now reach is what the browser will store, which is a
// fraction of the free disk and not a constant. It is far past 3.9 GB on a
// machine with room and under it on a full one — measured at 1.4 GB on a disk
// 98% full, where writing 3.9 GB would have been the worse answer.
check(
  'what it may hold is the storage it was granted',
  got.room > 0 &&
    got.room <= got.quota - 256 * 1024 * 1024 &&
    Math.abs(got.room - got.grant) < 4 * 1024 * 1024,
  `${(got.room / 1e9).toFixed(2)} GB of a ${(got.quota / 1e9).toFixed(2)} GB quota`,
)
check(
  'the head lands over the bytes it reserved',
  got.headPatched === true && got.size === 48 + 12,
  `${got.size} bytes`,
)
check(
  'the picture and the tail follow it, in order',
  JSON.stringify(got.picture) ===
    JSON.stringify([1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 9, 9]),
  JSON.stringify(got.picture),
)
check('the file is a movie', got.type === 'video/mp4', got.type)
check(
  'a finished take is left for the download to read',
  got.heldAfterClose === got.before + 1,
  `${got.before} before, ${got.heldAfterClose} after`,
)
check(
  'an abandoned take leaves no file',
  got.heldAfterDiscard === got.heldAfterClose,
  `${got.heldAfterDiscard} held`,
)
check(
  'the sweep spares a take a download could still be reading',
  got.sweptFresh === 0 && got.heldAfterFreshSweep === got.heldAfterDiscard,
  `${got.sweptFresh} swept`,
)
check(
  'and clears it once it is old enough',
  got.sweptStale === got.heldAfterDiscard && got.heldAfterStaleSweep === 0,
  `${got.sweptStale} swept, ${got.heldAfterStaleSweep} left`,
)
check(
  'the Blob fallback still makes a movie',
  got.blobStreamed === false && got.blobType === 'video/mp4',
)
check('no page errors', errors.length === 0, errors.join(' | '))

console.log(fail.length === 0 ? '\nsink ok' : `\n${fail.length} failed`)
process.exit(fail.length === 0 ? 0 : 1)
