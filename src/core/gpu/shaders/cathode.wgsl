// A worn picture tube's cathodes. Each gun can emit only so much current, and
// an old cathode has lost most of its coating, so it runs out: a highlight
// flattens toward a dull plateau, and the emission a bright run draws off the
// cathode takes microseconds to come back, so the picture to the right of a
// highlight is dimmed as the beam sweeps on. The three cathodes wear apart,
// and the most worn gun runs out first, which tints the highlights toward the
// other two.
//
// The same gun can leak from its heater. The heater runs on mains, and the
// insulation between it and the cathode conducts only near the peak of one
// half of the cycle, so that gun's bias takes a pulse of mains once a field. A
// band of the gun's own colour rises out of the blacks with a hard leading
// edge, rolling at the beat between the set's mains and the station's field.
//
// The emission state is a walk along each line in scan order, which decode's
// 64-pixel tiles cannot do, so this pass sits between decode and crt_face. One
// workgroup is one screen row: the row is staged, one lane per gun walks it,
// and the row is written back. Decode's phosphor and burn-in have already seen
// the beam this pass limits.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var srcTex: texture_2d<f32>;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;

const LANES = 128u;
var<workgroup> line: array<vec3f, ACTIVE_W>;

// Emission comes back with a time constant of about ten microseconds, at 14.3
// pixels a microsecond.
const RECOVER = 1.0 / 143.0;
// How fast a fully worn cathode is drawn down, per pixel per unit of light: a
// long run at 0.4 of white holds it under half its emission.
const DEPLETE = 0.021;
// The light a gun can still deliver at full emission: far above white on a
// good cathode, under half of it on a spent one.
const CEILING_NEW = 6.0;
const CEILING_SPENT = 0.45;
// The other two cathodes have worn this fraction as far as the weak one.
const OTHER_WEAR = 0.75;
// Bias swing of a full heater leak, in display drive, and the fraction of the
// mains peak the insulation holds off before it conducts.
const LEAK_DRIVE = 0.5;
const LEAK_ONSET = 0.55;

@compute @workgroup_size(LANES, 1, 1)
fn main(@builtin(local_invocation_id) lid: vec3u, @builtin(workgroup_id) wid: vec3u) {
  let y = wid.y;
  let weak = u32(clamp(P.weakGun, 0.0, 2.0));
  for (var x = lid.x; x < ACTIVE_W; x = x + LANES) {
    line[x] = textureLoad(srcTex, vec2u(x, y), 0).rgb;
  }
  workgroupBarrier();

  if (lid.x < 3u) {
    let g = lid.x;
    let wear = P.cathodeWear * select(OTHER_WEAR, 1.0, g == weak);
    let ceiling = mix(CEILING_NEW, CEILING_SPENT, wear);
    let ph = humPhase(f32(y + ACTIVE_TOP), P.frame);
    let conducts = max(sin(ph) - LEAK_ONSET, 0.0) / (1.0 - LEAK_ONSET);
    let bias = select(0.0, P.heaterLeak * LEAK_DRIVE * conducts, g == weak);
    var emission = 1.0;
    for (var x = 0u; x < ACTIVE_W; x = x + 1u) {
      var asked = line[x][g];
      if (bias != 0.0) {
        asked = toLight(vec3f(min(toDrive(vec3f(asked)).x + bias, 1.0))).x;
      }
      let cap = ceiling * emission;
      let given = cap * tanh(asked / cap);
      emission = emission + RECOVER * (1.0 - emission) - DEPLETE * wear * given;
      emission = max(emission, 0.05);
      line[x][g] = given;
    }
  }
  workgroupBarrier();

  for (var x = lid.x; x < ACTIVE_W; x = x + LANES) {
    textureStore(dstTex, vec2u(x, y), vec4f(toDrive(line[x]), 1.0));
  }
}
