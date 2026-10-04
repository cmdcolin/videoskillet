// What File System Access does this browser have, and can a take be written
// through it?
//
//   node scripts/fsacheck.mjs [port]
//
// A take spills its picture into Blobs as it encodes (`ui/record.ts`), so the
// heap no longer holds the file. What is left is that the browser's blob store
// holds all of it somewhere, and the way off that is writing the file as it is
// produced. This measures whether the APIs for doing so are here.
//
// Measured on Nightly 151 / Linux:
//
//   showSaveFilePicker        undefined
//   showDirectoryPicker       undefined
//   navigator.storage.getDirectory  function
//   createWritable            function
//   createSyncAccessHandle    undefined
//   a positional write patches bytes already written, and getFile() hands
//   back a disk-backed Blob an object URL will download
//
// So the *picker* is Chromium-only and the origin-private file system is not:
// a take can be streamed into OPFS, have its `mdat` length patched at the end,
// and reach the user as a File. What that costs is a write queue, because the
// encoder's `output` callback is synchronous and an OPFS write is not.
//
// Secure-context only — it runs against the app on localhost, because a probe
// that runs somewhere the app never does answers a question nobody asked.
//
// Says nothing about Safari, which is where the report that prompted this came
// from. Run it there.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { appUp } from './until.mjs'

import process from 'node:process'

const port = process.argv[2] ?? '5199'

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
  },
})
const page = await browser.newPage()
await page.goto(`http://localhost:${port}/app/`, {
  waitUntil: 'domcontentloaded',
})
await appUp(page, 6000)

const got = await page.evaluate(async () => {
  const out = {
    ua: navigator.userAgent,
    showSaveFilePicker: typeof window.showSaveFilePicker,
    showDirectoryPicker: typeof window.showDirectoryPicker,
    storageGetDirectory: typeof navigator.storage?.getDirectory,
    createWritable:
      typeof window.FileSystemFileHandle?.prototype?.createWritable,
    createSyncAccessHandle:
      typeof window.FileSystemFileHandle?.prototype?.createSyncAccessHandle,
  }
  // The three things a streamed mux needs: append, seek back to patch a header
  // whose length is only known at the end, and hand the result over as a file.
  try {
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle('fsacheck.bin', { create: true })
    const w = await handle.createWritable()
    await w.write(new Uint8Array(8).fill(0xaa))
    await w.write(new Uint8Array(4).fill(0xbb))
    await w.write({ type: 'write', position: 0, data: new Uint8Array([1, 2]) })
    await w.close()
    const f = await handle.getFile()
    const bytes = new Uint8Array(await f.arrayBuffer())
    out.opfs = {
      size: f.size,
      isBlob: f instanceof Blob,
      firstFour: Array.from(bytes.slice(0, 4)),
      downloadable: URL.createObjectURL(f).startsWith('blob:'),
    }
    await root.removeEntry('fsacheck.bin')
  } catch (e) {
    out.opfs = `${e.name}: ${e.message}`
  }
  return out
})
await browser.close()

console.log(got)

const ok =
  got.storageGetDirectory === 'function' &&
  got.createWritable === 'function' &&
  got.opfs?.firstFour?.join(',') === '1,2,170,170' &&
  got.opfs?.downloadable === true
console.log(
  ok
    ? 'a take can be streamed to the origin-private file system here'
    : 'no streamed path here: the take has to reach the browser as a Blob',
)
