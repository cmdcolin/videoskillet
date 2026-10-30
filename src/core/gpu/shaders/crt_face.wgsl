// CRT faceplate: turn the decoded signal into a picture of a glowing tube, so
// both the feedback camera (compose) and the display (present) photograph an
// emissive screen instead of the raw signal buffer. The beam spot spreads all
// light over a finite area of glass, the granular deposit mottles what it
// emits, highlight bloom spreads bright cores, halation adds a wide warm
// glass-scatter halo, a phosphor floor lifts blacks into a faint haze, and
// overbright phosphors clip toward white.
// Beam/scanline/mask geometry stays in present — it is sub-raster here; this
// pass is the photographic light behaviour that makes the loop read as a camera
// pointed at a monitor rather than a signal fed back on itself.
//
// Everything here is linear light (docs/adr/0014). srcTex is bound through an
// sRGB view, so the sampler hands back light, and the store encodes it again
// for present and compose to read the same way. Light is what adds: a halo
// that is a few percent of a white's light is a visible glow on black and
// nothing on a mid grey, which is how a halo looks on a tube. The same few
// percent added to display bytes lifted every tone alike, and read as a veil.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var srcTex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var faceTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<storage, read> timing: array<f32>;
// The deposit's mottle, baked once by grain_bake.wgsl: fixed to the glass, so
// hashing it per frame was sixteen hashes a pixel for the same sixteen values.
@group(0) @binding(5) var grainTex: texture_2d<f32>;

// P22 glass scatter is red-dominant, so bloom haze and the black-level glow
// both warm toward amber.
const WARM = vec3f(1.0, 0.62, 0.38);
const HALO_TIER = 0.2;

// Beam transfer. The gun's cutoff and gamma are already in the texture —
// decode applies them as it writes the screen (prelude gunTransfer), so no
// tap below pays a pow for them. Saturation is applied around luma *after*
// the transfer so vivid mids survive without posterizing, and it stays here:
// it can leave 0..1, which the 8-bit store would clip before bloom ever saw
// the excursion. It is linear in the colour, and so is every gather, so it is
// applied once to each gather's result rather than to each tap — the same
// light to within float rounding, and no branch in the tap loops. Identity at
// sat 1, so presets that don't set it are untouched.
fn beam(c: vec3f) -> vec3f {
  if (P.crtSat == 1.0) {
    return c;
  }
  return mix(vec3f(luma(c)), c, P.crtSat);
}
// Golden-angle disk taps, hoisted to tables: xy is direction times radius
// fraction, z the beam gaussian weight exp(-2 r^2). Computing these in the tap
// loop cost cos/sin/sqrt/exp per tap — ~64 transcendentals per pixel, the
// single most expensive thing in the pass. The spot picks a sparser table when
// its radius is small: a sub-pixel gaussian reaching the glass through the
// bilinear sampler is fully captured by a few taps, and the default 0.6 px
// spot was paying for sixteen.
const DISK4 = array<vec3f, 4>(
  vec3f(0.353553, 0.000000, 0.778801),
  vec3f(-0.451544, 0.413652, 0.472367),
  vec3f(0.069116, -0.787542, 0.286505),
  vec3f(0.569143, 0.742345, 0.173774),
);
const DISK8 = array<vec3f, 8>(
  vec3f(0.250000, 0.000000, 0.882497),
  vec3f(-0.319290, 0.292496, 0.687289),
  vec3f(0.048872, -0.556877, 0.535261),
  vec3f(0.402445, 0.524918, 0.416862),
  vec3f(-0.738535, -0.130636, 0.324652),
  vec3f(0.699605, -0.445031, 0.252840),
  vec3f(-0.234004, 0.870484, 0.196912),
  vec3f(-0.446271, -0.859268, 0.153355),
);
const DISK16 = array<vec3f, 16>(
  vec3f(0.176777, 0.000000, 0.939413),
  vec3f(-0.225772, 0.206826, 0.829029),
  vec3f(0.034558, -0.393771, 0.731616),
  vec3f(0.284571, 0.371173, 0.645649),
  vec3f(-0.522223, -0.092374, 0.569783),
  vec3f(0.494695, -0.314685, 0.502832),
  vec3f(-0.165466, 0.615525, 0.443747),
  vec3f(-0.315562, -0.607594, 0.391606),
  vec3f(0.684642, 0.250030, 0.345591),
  vec3f(-0.712256, 0.294009, 0.304983),
  vec3f(0.343354, -0.733729, 0.269146),
  vec3f(0.253731, 0.808932, 0.237521),
  vec3f(-0.764746, -0.443186, 0.209611),
  vec3f(0.897134, -0.197233, 0.184981),
  vec3f(-0.547507, 0.778772, 0.163246),
  vec3f(-0.126487, -0.976090, 0.144064),
);
// Sum of the gaussian weights in each table: what a gather over it divides by
// so a flat field comes back at its own level.
const W8 = 3.449668;
const W16 = 6.912818;

// One gun's direct emission: the beam-spot integral around a landing point.
// Factored out of main because convergence re-runs it per channel — each gun
// writes its own slightly displaced raster, and blurring a shared sample would
// average the landing error away instead of leaving it as a fringe. The tap
// count still scales with the spot: a sub-pixel gaussian reaching the glass
// through the bilinear sampler is fully captured by a few taps. `centre` is the
// sample at uv itself.
fn spotAt(uv: vec2f, centre: vec3f, dim: vec2f) -> vec3f {
  var acc = centre;
  var w = 1.0;
  if (P.crtSpot > 0.0) {
    if (P.crtSpot <= 0.8) {
      for (var i = 0u; i < 4u; i = i + 1u) {
        let t = DISK4[i];
        acc = acc + textureSampleLevel(srcTex, samp, uv + t.xy * P.crtSpot / dim, 0.0).rgb * t.z;
        w = w + t.z;
      }
    } else if (P.crtSpot <= 2.0) {
      for (var i = 0u; i < 8u; i = i + 1u) {
        let t = DISK8[i];
        acc = acc + textureSampleLevel(srcTex, samp, uv + t.xy * P.crtSpot / dim, 0.0).rgb * t.z;
        w = w + t.z;
      }
    } else {
      for (var i = 0u; i < 16u; i = i + 1u) {
        let t = DISK16[i];
        acc = acc + textureSampleLevel(srcTex, samp, uv + t.xy * P.crtSpot / dim, 0.0).rgb * t.z;
        w = w + t.z;
      }
    }
  }
  return beam(acc / w);
}

// The share of a pixel's light the spot pushes into the coating around it. The
// spot is space-charge limited, so it grows with beam current: a white core
// spreads, a dim one holds its edge. Saturating in the light so the fraction
// never passes the control's own ceiling.
fn spill(l: f32, fb: f32) -> f32 {
  return fb * l * l / (l * l + 0.1);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= ACTIVE_W || gid.y >= ACTIVE_H) {
    return;
  }
  let dim = vec2f(f32(ACTIVE_W), f32(ACTIVE_H));
  // Vertical deflection is analog: decode rolls the raster in whole lines
  // (floor of the v-osc phase), and the fractional remainder is a sub-line
  // offset of the entire scan, applied here in the deflection domain. A
  // rolling or settling picture glides instead of stepping line by line.
  // Identity when locked — the oscillator phase rests at exactly 0.
  let uv = (vec2f(gid.xy) + vec2f(0.5, 0.5 + fract(timing[V_PHASE]))) / dim;
  let centre = textureSampleLevel(srcTex, samp, uv, 0.0).rgb;

  // Identity copy when the light behaviour is disabled: keeps a clean signal
  // clean and skips the tap work.
  // Every mechanism below has to appear in this sum, or turning one on alone
  // would take the identity path and read as a dead control. The three faults
  // take abs() because their controls are signed: crossed guns and a reversed
  // SVM coil are as real as the nominal polarity.
  if (P.crtSpot + P.crtGrain + P.crtBloom + P.crtHalation + P.crtGlow
      + abs(P.crtConverge) + abs(P.crtPurity) + abs(P.crtSvm) <= 0.0) {
    textureStore(faceTex, vec2i(gid.xy), vec4f(toDrive(gamutFit(beam(centre))), 1.0));
    return;
  }

  // Disk taps at three radii: the beam spot itself, a tight cluster for bloom,
  // a wide one for halation. The feedback loop compounds the spread over
  // frames, so a modest single-pass kernel is enough. Each tap set is gated on
  // its own control — the branches are uniform across the dispatch, so an
  // unused radius costs nothing.
  // Beam spot: the gun writes a gaussian of finite width, so a sample's light
  // lands partly on its neighbours' phosphor and every edge is a ramp. Unlike
  // bloom this is not thresholded — dim picture bleeds too, which is why a
  // real tube never resolves into a grid of hard pixels.
  let px = vec2f(gid.xy) + vec2f(0.5, 0.5);
  var direct = spotAt(uv, centre, dim);

  // Convergence: three guns firing through one mask from three positions can
  // only be registered over part of the screen. The error is nulled at the
  // centre and grows toward the corners, so red lands outward and blue inward
  // of green, and edges pick up colour fringes that get worse the further out
  // they are. Only the direct emission is converged — the scatter below
  // integrates over a patch of glass far wider than any landing error, so it
  // comes back out registered no matter where the beams went in.
  if (P.crtConverge != 0.0) {
    let d = px - dim * 0.5;
    let q = d / (dim * 0.5);
    let rr = clamp(dot(q, q), 0.0, 2.0);
    let dir = d / max(length(d), 1e-6);
    let off = dir * (P.crtConverge * rr) / dim;
    let cr = spotAt(uv + off, textureSampleLevel(srcTex, samp, uv + off, 0.0).rgb, dim);
    let cb = spotAt(uv - off, textureSampleLevel(srcTex, samp, uv - off, 0.0).rgb, dim);
    direct = vec3f(cr.r, direct.g, cb.b);
  }

  // Scan velocity modulation: consumer sets patched differentiated luma into an
  // auxiliary deflection coil, so the beam decelerates through a dark→bright
  // transition and accelerates through a bright→dark one. Emission per unit
  // length goes as dwell time, so the light is *redistributed* across the edge
  // rather than added — a white overshoot on the rising side, a black notch on
  // the falling one. That asymmetry is the mechanism, not a bug; it is what SVM
  // was always criticised for. A negative amount is the coil wired backwards,
  // which swaps which side of every edge glows.
  if (P.crtSvm != 0.0) {
    let ap = max(P.crtSvmWidth, 0.25) / dim.x;
    let ll = luma(textureSampleLevel(srcTex, samp, uv - vec2f(ap, 0.0), 0.0).rgb);
    let lr = luma(textureSampleLevel(srcTex, samp, uv + vec2f(ap, 0.0), 0.0).rgb);
    direct = direct * max(1.0 + P.crtSvm * (lr - ll), 0.0);
  }

  // Purity: a magnetised patch of the shadow mask. The field bends all three
  // beams the same way, but a triad is three phosphor dots 120° apart, so one
  // displacement over-excites whichever dot it moves toward and starves the one
  // opposite. What comes out is a soft stain whose hue turns through the patch
  // rather than a flat tint — and it is fixed on the glass, so a rolling
  // picture travels through it instead of carrying it along.
  if (P.crtPurity != 0.0) {
    let pr = max(P.crtPuritySize, 1e-3) * dim.y;
    let dv = (px - vec2f(P.crtPurityX, P.crtPurityY) * dim) / pr;
    let land = P.crtPurity * exp(-2.0 * dot(dv, dv)) * dv;
    let g = vec3f(
      dot(land, vec2f(1.0, 0.0)),
      dot(land, vec2f(-0.5, 0.8660254)),
      dot(land, vec2f(-0.5, -0.8660254)),
    );
    direct = direct * max(vec3f(1.0) + g, vec3f(0.0));
  }

  // A loop each, gated on its own control. These used to share one gate and one
  // loop body, so either control being up ran both radii — a look with bloom up
  // and halation down paid a sixteen-tap gather across a 15-pixel disk for a
  // result that was then multiplied by zero, and a halo with no bloom under it
  // paid the same way round. Worth 0.12 ms of a 4.87 ms frame with bloom zeroed
  // (4.87 -> 4.75, three interleaved rounds, reproducible to the third digit).
  //
  // What this whole gather costs, measured by deleting both loops outright: 0.30
  // ms of a 4.90 ms frame, 6%. Cost is LINEAR in tap count at ~0.0094 ms/tap and
  // does not care about radius — dropping eight taps saves 0.08 ms whether they
  // sit on the 3.5-pixel bloom disk or the 15-pixel halo one, which were measured
  // separately and came out indistinguishable. So there is no locality win hiding
  // here and no superlinearity to exploit: the only lever on this gather is how
  // many taps run, and tiering (below) is the whole of it.
  //
  // Note when re-measuring: cost here reads as bimodal, ~0.8 ms apart, in whole
  // batches. That is not this pass and not the GPU's clocks — the discrete card
  // pins at its top DPM level and holds it, and 20 batches in one session vary by
  // 0.10 ms. It is another GPU client on the box. A second stepped session costs
  // 3.6 ms; one idle app tab left presenting costs 0.17 ms. Best-of survives it
  // and the median does not, so read `perf.mjs`'s per-batch list, compare best-of,
  // and check nothing else is holding a WebGPU tab open — an ablate delta taken
  // in the slow mode against one taken clean is how the numbers this comment used
  // to carry came out 8x too large.
  //
  // Both scatters add light. The phosphor emits into the glass, and only the
  // part inside the escape cone leaves straight away; the rest is trapped
  // between the faces until it is absorbed or finds its way out somewhere
  // else, and a clear faceplate gives a lot of it back. So the halo is light on
  // top of the direct emission, and a tinted faceplate is a lower control. The
  // coefficients are small because they are light: a few percent of a white
  // next to black is a visible glow there and nothing on a mid grey.
  //
  // Saturate → gamut-fit is the rest of the emissive stage: it is here so the
  // feedback camera photographs phosphor light, not decoder voltages.
  var col = gamutFit(direct);
  let rb = 3.5;
  if (P.crtBloom > 0.0) {
    // Tap count tiered on strength, the way spotAt tiers it on radius. The disk
    // is a fixed 3.5 px, so what decides whether sixteen taps are visible is not
    // how far they reach but how hard the result gets multiplied in. 78 of the
    // 80 presets sit at 0.6 or below and take the cheap path; the two that lean
    // on bloom keep the full disk. The threshold is a hard step, so sweeping
    // the control through 0.6 pops the bloom a little. Same bargain spotAt
    // already makes at 0.8 and 2.0.
    let fb = 0.04 * P.crtBloom;
    var bloom = vec3f(0.0);
    if (P.crtBloom <= 0.6) {
      for (var i = 0u; i < 8u; i = i + 1u) {
        let t = DISK8[i];
        let c = textureSampleLevel(srcTex, samp, uv + t.xy * rb / dim, 0.0).rgb;
        bloom = bloom + c * (t.z * spill(luma(c), fb));
      }
      bloom = bloom / W8;
    } else {
      for (var i = 0u; i < 16u; i = i + 1u) {
        let t = DISK16[i];
        let c = textureSampleLevel(srcTex, samp, uv + t.xy * rb / dim, 0.0).rgb;
        bloom = bloom + c * (t.z * spill(luma(c), fb));
      }
      bloom = bloom / W16;
    }
    col = col + beam(bloom);
  }

  // Glass scatter: light into the faceplate, bounced off the back, and back
  // out through the phosphor some way from where it went in. The spread grows
  // with beam current, so each tap's kernel is keyed off the light at the tap
  // — the emitter — and a dim emitter's share lands close in while a white's
  // reaches the full radius. Keying it off the receiving pixel instead traced a
  // fixed-width outline round anything bright and never reached into the dark,
  // which is exactly where a halo shows. Each kernel is divided by its own
  // area, so a narrower one carries about the same light, closer: the fixed
  // disk undersamples a narrow kernel, and a dim emitter's share comes out
  // 13% over a white's at the default key.
  if (P.crtHalation > 0.0) {
    let fh = 0.08 * P.crtHalation;
    let rh = 15.0 * (1.0 + P.crtHaloKey);
    var halo = 0.0;
    if (P.crtHalation <= HALO_TIER) {
      for (var i = 0u; i < 8u; i = i + 1u) {
        let t = DISK8[i];
        let l = luma(textureSampleLevel(srcTex, samp, uv + t.xy * rh / dim, 0.0).rgb);
        let s = (1.0 + P.crtHaloKey * min(l, 1.0)) / (1.0 + P.crtHaloKey);
        halo = halo + l * exp(-2.0 * dot(t.xy, t.xy) / (s * s)) / (s * s);
      }
      halo = halo / W8;
    } else {
      for (var i = 0u; i < 16u; i = i + 1u) {
        let t = DISK16[i];
        let l = luma(textureSampleLevel(srcTex, samp, uv + t.xy * rh / dim, 0.0).rgb);
        let s = (1.0 + P.crtHaloKey * min(l, 1.0)) / (1.0 + P.crtHaloKey);
        halo = halo + l * exp(-2.0 * dot(t.xy, t.xy) / (s * s)) / (s * s);
      }
      halo = halo / W16;
    }
    col = col + fh * halo * WARM;
  }

  // Granular deposit: the coating is a layer of crystallites, not a uniform
  // film, so emission is mottled. The modulation peaks in the mids — black
  // grains emit nothing to vary, and a fully driven grain has no headroom left
  // to vary in — which is why grain reads as screen texture rather than noise.
  // Direct emission only: the scattered light added below integrates over many
  // grains on its way through the glass and comes out smooth. The mids are
  // the eye's mids, so the shape is taken on the encoded level, and the depth
  // is scaled by the slope of the curve so the same control reads the same.
  if (P.crtGrain > 0.0) {
    let l = luma(toDrive(col));
    col = col * (1.0 + P.crtGrain * (textureLoad(grainTex, vec2i(gid.xy), 0).r - 0.5) * 8.8 * l * (1.0 - l));
  }

  // Phosphor glow floor: the glass is never truly black — a faint warm haze
  // that lifts with nearby light, plus a small ambient pedestal.
  col = col + P.crtGlow * WARM * (0.001 + 0.2 * luma(col));

  // Overbright phosphors desaturate toward white as the beam saturates.
  let l = luma(col);
  col = mix(col, vec3f(l), clamp((l - 0.7) * 2.5, 0.0, 0.6));

  textureStore(faceTex, vec2i(gid.xy), vec4f(toDrive(clamp(col, vec3f(0.0), vec3f(1.0))), 1.0));
}
