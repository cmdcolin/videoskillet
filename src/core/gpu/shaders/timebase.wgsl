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

@group(0) @binding(0) var<storage, read> lineParams: array<vec4f>;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;
  let row = gid.y;
  if (s >= SPL || row >= NLINES) {
    return;
  }
  let n = row * SPL + s;
  let sm = lineParams[row * 2u + 1u].x;
  let smNext = lineParams[min(row + 1u, NLINES - 1u) * 2u + 1u].x;
  let pos = f32(n) + lineParams[row * 2u].x + (smNext - sm) * f32(s) / f32(SPL);
  let i0 = i32(floor(pos));
  dst[n] = catmull(src[clampIdx(i0 - 1)], src[clampIdx(i0)], src[clampIdx(i0 + 1)], src[clampIdx(i0 + 2)], fract(pos));
}
