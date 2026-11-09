// Time-base error: each line is resampled by a fractional offset that the CPU
// advances continuously (wow + flutter random walk, head-switch step). This is
// what a signal without a TBC looks like: horizontal jitter and skew, and the
// burst moves with it so decoder hue wobbles too.
//
// The smooth part of the error is continuous in time, so it does not step at
// the line start and hold: it ramps along the line to where the next line
// begins. The burst at the left sees almost none of the ramp and the right
// edge sees all of it, which is the velocity error a decoder cannot take out
// on the burst. Steps (the head switch, a track crossing) stay steps.
//
// The cable from the last deck to the set comes after its time-base error, so
// the program bus's termination fault (prelude `terminate`) acts here, on the
// generation the set plays back. Its echo is this pass's own output five
// samples back, which is everything the deck and the cable did to the signal,
// and an open centre pin upstream leaves nothing to reflect.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> lineParams: array<vec4f>;
@group(0) @binding(2) var<storage, read> src: array<f32>;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;

fn resampled(row: u32, s: u32) -> f32 {
  let n = row * SPL + s;
  let sm = lineParams[row * 2u + 1u].x;
  let smNext = lineParams[min(row + 1u, NLINES - 1u) * 2u + 1u].x;
  // The offset is kept apart from n: past the middle of the frame an f32 index
  // resolves only a 32nd of a sample, a step in hue down the picture.
  let off = lineParams[row * 2u].x + (smNext - sm) * f32(s) / f32(SPL);
  let i0 = i32(n) + i32(floor(off));
  return catmull(src[clampIdx(i0 - 1)], src[clampIdx(i0)], src[clampIdx(i0 + 1)], src[clampIdx(i0 + 2)], fract(off));
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;
  let row = gid.y;
  if (s >= SPL || row >= NLINES) {
    return;
  }
  let n = row * SPL + s;
  var out = resampled(row, s);
  let term = select(0.0, P.termination, P.gen == P.lastGen);
  if (term != 0.0) {
    let e = clampIdx(i32(n) - 5);
    out = terminate(out, term, resampled(e / SPL, e % SPL));
  }
  dst[n] = out;
}
