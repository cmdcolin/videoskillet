// The two pipes either side of the signal path.
//
// ffmpeg rather than a library on both ends, for the reason the whole CLI
// exists: the browser's encoder roster is what caps export quality, and the way
// past it is to stop asking a browser. It also means the input side inherits
// every format ffmpeg reads, which is the half no WebCodecs demuxer was ever
// going to match.
//
// Frames cross as raw `rgba` at the signal raster's own size, so nothing here
// scales, converts or guesses: `-s` on the decode side and `-pix_fmt rgba` on
// both is the whole contract.

// What to write. ProRes 4444 is the default because it is the reason to be
// here: 4:4:4, so the dot crawl and rainbow fringing survive, and every NLE
// opens it. The other three are for when the file has to travel.
export const CODECS: Record<string, string[]> = {
  // 4:4:4, and `-profile:v 4` is the 4444 one.
  prores: ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le'],
  // Avid's, for a Media Composer round trip. 4:2:2, so chroma detail is halved.
  dnxhr: [
    '-c:v',
    'dnxhd',
    '-profile:v',
    'dnxhr_hqx',
    '-pix_fmt',
    'yuv422p10le',
  ],
  // Lossless, when the render is an intermediate and size does not matter.
  ffv1: ['-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'yuv444p'],
  // For sending someone. Still 4:4:4 — `yuv444p` with H.264 High 4:4:4
  // Predictive, which x264 encodes even though no browser will.
  h264: [
    '-c:v',
    'libx264',
    '-profile:v',
    'high444',
    '-preset',
    'slow',
    '-crf',
    '12',
    '-pix_fmt',
    'yuv444p',
  ],
}

export interface Source {
  // The next frame as tightly-packed RGBA, or null once the input is spent.
  next: () => Promise<Uint8Array | null>
  close: () => Promise<void>
}

export interface Sink {
  write: (rgba: Uint8Array) => Promise<void>
  close: () => Promise<void>
}

// Read exactly `n` bytes, or null if the stream ended first. A pipe hands over
// whatever it has, so a frame arrives in several reads and the last one is
// usually short — treating a short read as the end is how a decoder loses the
// bottom of every frame.
async function readFull(
  r: ReadableStreamDefaultReader<Uint8Array>,
  buf: Uint8Array,
  carry: { rest: Uint8Array },
): Promise<boolean> {
  let at = 0
  if (carry.rest.length > 0) {
    const take = Math.min(carry.rest.length, buf.length)
    buf.set(carry.rest.subarray(0, take))
    carry.rest = carry.rest.subarray(take)
    at = take
  }
  while (at < buf.length) {
    const { value, done } = await r.read()
    if (done) return false
    const take = Math.min(value.length, buf.length - at)
    buf.set(value.subarray(0, take), at)
    at += take
    if (take < value.length) carry.rest = value.subarray(take)
  }
  return true
}

export function ffmpegDecode(
  path: string,
  w: number,
  h: number,
  fps: number,
): Source {
  const cmd = new Deno.Command('ffmpeg', {
    args: [
      '-v',
      'error',
      '-i',
      path,
      // The raster is 754x480 with non-square pixels, and the source is
      // whatever it is. `scale` then `setsar` puts the picture on the raster
      // the way the app's own staging does.
      '-vf',
      `scale=${w}:${h}:flags=lanczos,setsar=1`,
      '-r',
      String(fps),
      '-pix_fmt',
      'rgba',
      '-f',
      'rawvideo',
      '-',
    ],
    stdout: 'piped',
    // **Held rather than inherited, because stopping early is normal here.** A
    // render of the first three seconds of a six-second file closes the pipe on
    // a decoder that still had frames to hand over, and ffmpeg says so in four
    // lines of `Broken pipe` — which is this program working correctly and
    // reads as it failing. Kept and printed only when no frame ever arrived,
    // which is the case where ffmpeg's own words are the diagnosis.
    stderr: 'piped',
  })
  const child = cmd.spawn()
  const reader = child.stdout.getReader()
  const carry = { rest: new Uint8Array(0) }
  let spent = false
  let delivered = 0
  const errText = new Response(child.stderr).text()
  return {
    next: async () => {
      if (spent) return null
      const buf = new Uint8Array(w * h * 4)
      const ok = await readFull(reader, buf, carry)
      if (!ok) {
        spent = true
        return null
      }
      delivered++
      return buf
    },
    close: async () => {
      try {
        await reader.cancel()
      } catch {
        // The reader is already gone when the input ended on its own.
      }
      try {
        child.kill()
      } catch {
        // Likewise the process.
      }
      await child.status
      if (delivered === 0) {
        const text = (await errText).trim()
        throw new Error(
          text === ''
            ? `ffmpeg read no frames from ${path}`
            : `ffmpeg could not read ${path}:\n${text}`,
        )
      }
    },
  }
}

export function ffmpegEncode(
  path: string,
  w: number,
  h: number,
  fps: number,
  codec: string,
): Sink {
  const cmd = new Deno.Command('ffmpeg', {
    args: [
      '-v',
      'error',
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${w}x${h}`,
      '-r',
      String(fps),
      '-i',
      '-',
      // 4:3 on a 754x480 raster: the signal's pixels are not square, and an
      // editor reads the aspect off the file rather than measuring it.
      '-aspect',
      '4:3',
      ...CODECS[codec],
      path,
    ],
    stdin: 'piped',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const child = cmd.spawn()
  const writer = child.stdin.getWriter()
  return {
    write: async rgba => {
      await writer.write(rgba)
    },
    close: async () => {
      await writer.close()
      const status = await child.status
      if (!status.success) {
        throw new Error(`ffmpeg exited ${status.code}`)
      }
    },
  }
}

// How many frames the input holds at the output rate. Asked of ffprobe rather
// than counted, so the progress line is honest from the first frame.
export async function probeFrames(path: string, fps: number): Promise<number> {
  const out = await new Deno.Command('ffprobe', {
    args: [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nw=1:nk=1',
      path,
    ],
    stdout: 'piped',
    stderr: 'inherit',
  }).output()
  const seconds = Number(new TextDecoder().decode(out.stdout).trim())
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`could not read a duration from ${path}`)
  }
  return Math.round(seconds * fps)
}
