// The noise reducer's motion detector. It compares the incoming picture with
// the frame memory over a 4-sample window, which spans one subcarrier cycle and
// so nulls chroma, on this line and the two beside it. Noise reaches it too,
// so a threshold near the noise floor trips at random on still picture.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> comp: array<f32>;
@group(0) @binding(2) var<storage, read> store: array<f32>;
@group(0) @binding(3) var<storage, read_write> motion: array<f32>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;
  let row = gid.y;
  if (s >= SPL || row >= NLINES) {
    return;
  }
  let n = row * SPL + s;
  let picture = s >= ACTIVE_START && s < ACTIVE_START + ACTIVE_W
    && row >= ACTIVE_TOP && row < ACTIVE_TOP + ACTIVE_H;
  var m = 0.0;
  if (picture) {
    let read = nrSlot(P.frame + 2u - u32(P.nrLag));
    for (var dr = -1; dr <= 1; dr = dr + 1) {
      let r = u32(clamp(i32(row) + dr, i32(ACTIVE_TOP), i32(ACTIVE_TOP + ACTIVE_H) - 1));
      var d = 0.0;
      for (var k = -1; k <= 2; k = k + 1) {
        let i = r * SPL + u32(i32(s) + k);
        d = d + comp[i] - store[read + i];
      }
      m = m + abs(d) * 0.25;
    }
    m = m / 3.0;
  }
  motion[n] = m;
}
