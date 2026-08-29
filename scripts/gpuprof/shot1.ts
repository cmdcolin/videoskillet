// One frame of one patch, full size, to a file — the eyeball check behind a
// number `survey.ts` printed.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/shot1.ts \
//     fmOverdev=1,fmStreakUs=0.7 out.png detail
//
import { DEFAULT_CONTROLS } from '../../src/core/controls'
import { Runner } from './render'

import type { ControlKey, Controls } from '../../src/core/controls'

const set = (Deno.args[0] ?? '').split(',').filter(Boolean)
const out = Deno.args[1] ?? 'shot.png'
const c: Controls = { ...DEFAULT_CONTROLS }
for (const kv of set) {
  const [k, v] = kv.split('=')
  c[k as ControlKey] = Number(v)
}
const r = await Runner.create(Deno.args[2] === 'detail' ? 'detail' : 'bars')
const { shots } = await r.run(c, 120, { tail: [0], w: 754, h: 480 })
const bytes = new Uint8Array(shots[0].length)
for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(shots[0][i])
const cmd = new Deno.Command('ffmpeg', {
  args: [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-s',
    '754x480',
    '-i',
    'pipe:0',
    out,
  ],
  stdin: 'piped',
}).spawn()
const w = cmd.stdin.getWriter()
await w.write(bytes)
await w.close()
await cmd.status
console.log('wrote', out)
