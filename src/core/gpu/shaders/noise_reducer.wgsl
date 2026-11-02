// A frame-recursive noise reducer, the outboard box between the deck and the
// set. Where the detector sees no motion it mixes the frame memory into the
// picture; where it trips it passes the picture through. The gate is hard, so
// a moving edge drags a trail that stops where the detector trips.
//
// The memory is a short word. Each still sample moves only (1 - k) of the way
// toward the input, and a step smaller than half a code rounds back to where
// it was, so slow gradients and fine grain freeze into flat plateaus.
//
// The subcarrier inverts every frame. A two-frame store reads back chroma at
// the phase it is being mixed with. A one-frame store mixes every chroma cycle
// with its own inverse, so colour drains out of still picture and stays on
// whatever moves.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> comp: array<f32>;
@group(0) @binding(2) var<storage, read_write> store: array<f32>;
@group(0) @binding(3) var<storage, read> motion: array<f32>;

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
  if (picture) {
    let x = comp[n];
    let held = store[nrSlot(P.frame + 2u - u32(P.nrLag)) + n];
    let k = select(0.0, P.nrK, motion[n] < P.nrThresh);
    let y = round((x + k * (held - x)) / P.nrStep) * P.nrStep;
    store[nrSlot(P.frame) + n] = y;
    comp[n] = y;
  }
}
