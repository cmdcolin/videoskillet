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
// its faults act here, on the generation the set plays back: the loose plug,
// the swapped pair and the termination. The termination's echo is the cable's
// own output five samples back, which carries everything the decks and the
// cable did to the signal, and an open centre pin leaves nothing to reflect.
// The deck's OSD and the outboard enhancer run in later passes, so the echo
// leaves them out.

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

// cableAt gives the cable's output at a sample. It passes through a loose plug
// on the program bus (prelude `connectorAt`), shared with the per-source feeds,
// which wiggle one input's plug alone, and then a hard polarity flip, with
// signal and ground fully swapped on the line. Unlike the clean encoder invert (active video only), this
// negates the whole waveform, sync tips and burst included, so the receiver's
// sync separator latches onto the wrong level and the picture tears and rolls
// while the colours invert.
fn cableAt(row: u32, s: u32) -> f32 {
  let v = connectorAt(resampled(row, s), row, row * SPL + s, P.frame, P.gen, P.connectorGlitch, P.connectorMode);
  return mix(v, -v, P.polarityFlip);
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;
  let row = gid.y;
  if (s >= SPL || row >= NLINES) {
    return;
  }
  let n = row * SPL + s;
  var out: f32;
  if (P.gen == P.lastGen) {
    var echo = 0.0;
    if (P.termination > 0.0) {
      let e = clampIdx(i32(n) - 5);
      echo = cableAt(e / SPL, e % SPL);
    }
    out = terminate(cableAt(row, s), P.termination, echo);
  } else {
    out = resampled(row, s);
  }
  dst[n] = out;
}
