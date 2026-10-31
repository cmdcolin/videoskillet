// Handing a file to the user, and what to call it.
//
// Two things save files now — the live recorder (`useCapture`) and the offline
// render (`useRender`) — and they have to agree on the name, because a folder
// holding both is a folder somebody is trying to sort by time.

import { pad2 } from './format'

// yyyymmdd-hhmmss, so saved files sort chronologically and never collide.
function stamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

export function fileName(name: string, ext: string): string {
  const slug = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return `videoskillet-${slug}-${stamp()}.${ext}`
}

// How long the object URL outlives the click, which has to cover the browser
// reading the whole blob into the download. The two seconds this used to wait
// served a PNG; a take is a gigabyte-scale file, and a revoked URL is a
// download with nothing behind it. Long enough for a slow disk to write the
// largest file the app makes, and no longer, so a session of takes does not
// hold on to every one of them.
const REVOKE_MS = 120_000

export function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS)
}
