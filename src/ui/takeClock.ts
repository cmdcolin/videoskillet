// The clock a live take places its frames on, in seconds.
//
// A take with sound runs on the sound's clock, so the picture cannot drift off
// it. Reading that clock from the main thread is the hard part: Firefox
// refreshes `currentTime` about 74 times a second, so a read lags the audio
// thread by 8 ms at the median and up to 56 ms. A frame placed off one read
// lands up to a whole frame period off. The clock here averages
// `currentTime - performance.now()` over the last second of readings, which
// places every frame within rounding of its slot, and the average moves with
// the audio clock if it drifts against the wall.
//
// The average sits half a refresh behind the audio thread, about 7 ms, which is
// well inside lip sync. Subtracting the output latency moves the clock from
// when a sample is processed to when it is heard, which is when the frame
// rendered alongside it is seen.

export interface TakeClock {
  // Take a reading. A wall clock needs none.
  sample: () => void
  // The clock's time at a `performance.now()` reading, in seconds.
  at: (now: number) => number
}

export const wallClock = (): TakeClock => ({
  sample: () => {},
  at: now => now / 1000,
})

// The readings averaged. At one every 2 ms that is the last second.
const WINDOW = 512

export interface ClockSource {
  currentTime: number
  outputLatency?: number
  baseLatency?: number
}

export function audioClock(
  ctx: ClockSource,
  read: () => number = () => performance.now(),
): TakeClock {
  const ring = new Float64Array(WINDOW)
  let n = 0
  let sum = 0
  const sample = () => {
    const d = ctx.currentTime * 1000 - read()
    const i = n % WINDOW
    if (n >= WINDOW) sum -= ring[i]
    ring[i] = d
    sum += d
    n++
  }
  return {
    sample,
    at: now => {
      if (n === 0) sample()
      const lead = sum / Math.min(n, WINDOW)
      return (
        (now + lead) / 1000 - (ctx.outputLatency ?? 0) - (ctx.baseLatency ?? 0)
      )
    },
  }
}
