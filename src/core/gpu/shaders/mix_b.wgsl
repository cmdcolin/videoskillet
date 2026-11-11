// Source B is a second, fully-formed NTSC signal. Two ways to combine it:
//
// - Dirty sum (default): B is NOT genlocked to A. Its line timing slips and
//   skews (line-frequency offset), its frame rolls (field-rate offset), and its
//   subcarrier is detuned off the sampling lattice. B arrives as a real
//   waveform on its own raster (encode_composite_b, optionally through its
//   feed), and this pass resamples it at the slipped position and sums it
//   (optionally ring-modulated) BEFORE the channel, sync separator, and burst
//   measurement — so fighting sync, rolling bars, tilted tears, and chroma
//   beat patterns all emerge downstream instead of being painted.
//
// - Clean dissolve (bGenlock): B is genlocked to the house reference and
//   re-encoded on A's carrier and raster, then combined as a CROSSFADE, not a
//   sum — a production switcher dissolve/wipe. bGain is the fader; the wipe
//   pattern shapes the fade spatially so B replaces A rather than adding to it.
//   B's detune/roll/skew and ring mod do not apply on this path.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var inputTexB: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> uvfB: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> comp: array<f32>;
@group(0) @binding(4) var<storage, read> bComp: array<f32>;
// Last frame's finished composite — the mixer loop's bus, the same buffer
// fbComposite crossfades from further down the chain. Bound here so the keyer
// can take its fill off it: patching the mixer's own output back into a keyer's
// fill input is a wire someone would run, and what it buys is a loop that only
// regenerates inside the keyed shape.
@group(0) @binding(5) var<storage, read> loopBus: array<f32>;

// B's luma at a raster index, off the texel; none outside its active picture,
// where a textureLoad past the edge returns whatever the backend chooses.
fn lumaBAt(idx: u32) -> f32 {
  let x = i32(idx % SPL) - i32(ACTIVE_START);
  let y = i32(idx / SPL) - i32(ACTIVE_TOP);
  let inside = x >= 0 && x < i32(ACTIVE_W) && y >= 0 && y < i32(ACTIVE_H);
  let texel = srcTexelB(inputTexB, clamp(x, 0, i32(ACTIVE_W) - 1), clamp(y, 0, i32(ACTIVE_H) - 1), P.deintB);
  return select(0.0, luma(texel), inside);
}

// B's alpha at a raster index: the key output a source with transparency
// sends beside its picture. It is 1 outside the active picture, so the
// external key never takes B's sync and burst off the bus.
fn alphaBAt(idx: u32) -> f32 {
  let x = i32(idx % SPL) - i32(ACTIVE_START);
  let y = i32(idx / SPL) - i32(ACTIVE_TOP);
  let inside = x >= 0 && x < i32(ACTIVE_W) && y >= 0 && y < i32(ACTIVE_H);
  return select(1.0, srcTexelAlphaB(inputTexB, clamp(x, 0, i32(ACTIVE_W) - 1), clamp(y, 0, i32(ACTIVE_H) - 1), P.deintB).a, inside);
}

// B's picture luma scaled by what the chroma pin left of it, before B's
// video gain and inversion.
fn wireLumaBAt(idx: u32) -> f32 {
  return (1.0 - max(P.bChromaPin, 0.0)) * lumaBAt(idx);
}

// B re-encoded on the house carrier: chroma at bIdx modulated onto the
// A-locked subcarrier at output sample houseN (B's proc-amp hue trim only). This
// is the genlocked path — used by the clean dissolve and the PiP DVE — so B
// dot-crawls like real video but does not beat or roll. The encoder chroma
// bandlimit is precomputed per B sample by encode_chroma_b — B's raster
// position is per-sample here, so running the FIR inline read 33 unstaged
// storage taps per consumer sample.
//
// The inset reads B from its source rather than its feed, so B's chroma pin
// is applied here against the encoder's own chroma.
fn encodeBHouse(houseN: u32, bIdx: u32) -> f32 {
  let uv = uvfB[bIdx];
  let sc = carrierRot(houseN, P.frame, P.bHue);
  return chromaPin(
    activeComposite(lumaBAt(bIdx), uv.x, uv.y, sc, P.bVidGain, P.bInv),
    activeChroma(uv.x, uv.y, sc, P.bVidGain, P.bInv),
    P.bChromaPin,
  );
}

// A chroma keyer across the mixer: B's backing colour cut away so A shows
// through it. What decides the look is where the keyer is standing. A real one
// is a box on the bus, so it never sees the RGB the camera had — it slices the
// chroma the encoder made, which is `uvfB`: B's U and V after the encoder's
// bandlimit (encChromaMHz, 1.3 MHz by default). That filter has no vertical
// term, so the key it cuts is soft over about four samples across and razor
// sharp down — the lopsided, faintly stepped edge that every composite key has
// and no RGB keyer can produce. Nothing draws it, and narrowing the encoder's
// chroma widens it, because it is the same filter doing both jobs.
//
// The box demodulates that chroma against the house reference, so it sees B's
// colour as the bus carries it: turned by B's hue trim and by wherever B's
// carrier stands against house, scaled by B's video gain and by what contact
// the colour wire of B's lead has left, and flipped by its inversion. On the dirty path B's subcarrier is detuned, so its chroma phase
// walks per line and per frame: the backing drifts out of the acceptance wedge
// and back, and the key breathes and tears line-wise instead of holding. That
// is what a keyer fed a non-genlocked source did, and it is why they were
// genlocked.
//
// The keyer's Y/C separation is perfect. Demodulating the composite itself
// would turn every luma edge in B into a spike of false chroma.
struct KeySlice {
  // 1 where B is kept, 0 where the backing has been cut away.
  gate: f32,
  // The part of this sample's chroma that points at the backing colour, for
  // the suppressor below — the spill the keyer decided was not enough to cut.
  spill: vec2f,
  // How much backing colour the sample holds, for the additive keyer: its
  // chroma along the key hue, less its chroma across it scaled so the two
  // balance at the edge of the acceptance wedge. Zero or below on anything the
  // wedge leaves out, and proportional to the light on the backing inside it.
  level: f32,
}

// The angle B's carrier stands at against the house carrier, at B's raster
// index `at` and `frac` of the way to the next sample. The carrier turns a
// quarter cycle per sample, so the lattice offset is reduced in integers
// before it becomes an angle. `delta` is the phase B was encoded with.
fn busPhase(at: i32, n: u32, frac: f32, delta: f32) -> f32 {
  return (f32((at - i32(n)) & 3) + frac) * 0.5 * PI + delta;
}

// What B's feed did to B's chroma around raster index i, in the same axes as
// uvfB. The keyer is a box on the bus, so the snow, ghosts and ringing B picked
// up on its way are in what it slices, and a sample near the edge of the slice
// is pushed across it and back from one frame to the next: the key chatters.
// Only the damage is demodulated. It is B's waveform less B as the encoder
// wrote it, so B's own luma cancels and its edges do not turn into false
// chroma, which is what demodulating the whole composite would do. One
// subcarrier cycle of it is summed against B's own carrier, which is the
// shortest window that separates U from V. B as the encoder wrote it carries
// B's chroma pin against the encoder's chroma, so the luma the pin takes away
// cancels too, and what the deck's bandpass lets through as colour remains.
fn feedChroma(i: i32) -> vec2f {
  var delta = P.bHue;
  if (P.bGenlock < 0.5) {
    delta = delta + P.bPhase0 + P.bPhaseLine * f32(clampIdx(i) / SPL);
  }
  var acc = vec2f(0.0);
  for (var j = -1; j <= 2; j++) {
    let idx = clampIdx(i + j);
    let sc = carrierRot(idx, P.frame, delta);
    let uv = uvfB[idx];
    let clean = chromaPin(
      activeComposite(lumaBAt(idx), uv.x, uv.y, sc, P.bVidGain, P.bInv),
      activeChroma(uv.x, uv.y, sc, P.bVidGain, P.bInv),
      P.bChromaPin,
    );
    acc = acc + (bComp[idx] - clean) * sc;
  }
  return acc / (2.0 * VIDEO_RANGE);
}

// `at` is where B's picture is for this output sample, on B's own raster, and
// `phase` is busPhase there. `damaged` adds what B's feed did to the chroma.
fn chromaKey(at: i32, phase: f32, damaged: bool) -> KeySlice {
  // Where the keyer looks, against where the fill it is gating comes from. A
  // real keyer trims this because the key path and the video path are
  // different lengths of circuit, and a mis-set one lays the key beside the
  // subject instead of over it: one edge keeps a rim of backing colour and the
  // other eats a rim of subject. The trim is continuous, so the chroma is read
  // between the two samples either side of it.
  let d = floor(P.bKeyDelay);
  let i = at + i32(d);
  let enc = mix(uvfB[clampIdx(i)], uvfB[clampIdx(i + 1)], P.bKeyDelay - d);
  let c = cos(phase);
  let s = sin(phase);
  var uv = vec2f(enc.x * c - enc.y * s, enc.x * s + enc.y * c)
    * P.bVidGain * (1.0 - 2.0 * P.bInv) * (1.0 + min(P.bChromaPin, 0.0));
  if (damaged && P.bKeyFeed > 0.5) {
    let dmg = feedChroma(i);
    uv = uv + vec2f(dmg.x * c - dmg.y * s, dmg.x * s + dmg.y * c);
  }
  let soft = max(P.bKeySoft, 1e-4);
  let kdir = vec2f(cos(P.bKeyHue), sin(P.bKeyHue));
  let across = max(cos(P.bKeyAccept), 0.0) / max(sin(P.bKeyAccept), 1e-3);
  let level = dot(uv, kdir) - across * abs(uv.x * kdir.y - uv.y * kdir.x);
  // Below the clip there is no hue to slice: a demodulator handed an
  // unsaturated sample reports an essentially arbitrary phase, so greys, blacks
  // and the backing's own shadows stay opaque however close their angle lands
  // to the key. This is the "clip" knob, and it is why a keyer cannot hold a
  // dark subject against a dark backing.
  let satg = smoothstep(P.bKeyClip, P.bKeyClip + soft, length(uv));
  var g = 1.0 - hueGate(uv, P.bKeyHue, P.bKeyAccept, soft * PI) * satg;
  if (P.bKey < 0.0) {
    // The invert button: keep the backing and cut the subject out of it.
    g = 1.0 - g;
  }
  return KeySlice(mix(1.0, g, min(abs(P.bKey), 1.0)), kdir * max(dot(uv, kdir), 0.0) * satg, level);
}

// The external key: B's alpha patched into the keyer's key input in place of
// the chroma slice. It is a separate wire, so B's encoder bandlimit and its
// feed damage never reach it, and its edge is as sharp as the source drew it.
// It runs through the same registration trim as the chroma slice, and the
// invert button works on it the same way. With nothing to subtract, the
// additive keyer is out of circuit, and the spill canceller has no backing to
// null.
fn alphaKey(at: i32) -> KeySlice {
  let d = floor(P.bKeyDelay);
  let i = at + i32(d);
  var g = mix(alphaBAt(clampIdx(i)), alphaBAt(clampIdx(i + 1)), P.bKeyDelay - d);
  if (P.bKey < 0.0) {
    g = 1.0 - g;
  }
  return KeySlice(mix(1.0, g, min(abs(P.bKey), 1.0)), vec2f(0.0), 0.0);
}

// The key on whichever input the source switch selects.
fn keyOf(at: i32, phase: f32, damaged: bool) -> KeySlice {
  var k: KeySlice;
  if (P.bKeySource > 0.5) {
    k = alphaKey(at);
  } else {
    k = chromaKey(at, phase, damaged);
  }
  return k;
}

// Spill suppression, as the hardware did it: a chroma canceller. You cannot
// lift the green off a composite sample — luma and chroma are the same wire —
// so the box reinjects the backing colour on the house carrier in antiphase
// and nulls the component of B's chroma lying along the key hue. Whatever part
// of the backing has drifted off that phase survives, which is why a source
// whose carrier is slipping keeps a residue that breathes with the slip.
fn suppress(spill: vec2f, n: u32) -> f32 {
  return VIDEO_RANGE * P.bKeySpill * dot(spill, carrier(n, P.frame));
}

// The additive keyer: the Ultimatte's design, on the bus. The comparator above
// decides keep or cut. This box measures how much backing a sample holds,
// against the backing's level at full light, and that share is a matte
// proportional to the light falling on the backing. It subtracts that share of
// the backing from B, luma and chroma both, and adds the same share of the fill
// under what is left. A shadow on the backing is a sample holding less backing,
// so it comes out as a shadow on the fill. A strand finer than the chroma band
// holds a little backing and keys part way. Spill is backing too and goes with
// the same subtraction, so colours off the key hue are never touched.
//
// The share runs past 1 for the subtraction, so a patch of backing lit brighter
// than the calibration is still removed, up to half as bright again. Past that
// it keeps a lifted residue, which is what a backing level set too low does.
fn backingShare(k: KeySlice) -> f32 {
  return clamp(k.level / max(P.bKeyLevel, 1e-3), 0.0, 1.5);
}

// B with its backing subtracted. The box clips the luma it takes away at B's
// own luma, so a calibration set too bright drives the backing to black and no
// further, where it would otherwise dig down toward sync.
fn subtractBacking(fill: f32, k: KeySlice, at: i32, n: u32) -> f32 {
  let share = backingShare(k) * min(abs(P.bKey), 1.0);
  let kdir = vec2f(cos(P.bKeyHue), sin(P.bKeyHue));
  let y = min(share * P.bKeyBackY, wireLumaBAt(clampIdx(at)));
  return fill - VIDEO_RANGE * (y + share * P.bKeyLevel * dot(kdir, carrier(n, P.frame)));
}

// The additive keyer's gate when inverted: the backing is kept in proportion
// to how much of it there is and the subject is cut out of it.
fn keepBacking(k: KeySlice) -> f32 {
  return mix(1.0, min(backingShare(k), 1.0), min(abs(P.bKey), 1.0));
}

// How much of B the key keeps at a sample, whichever keyer is cutting.
fn keptBy(k: KeySlice) -> f32 {
  var kept = k.gate;
  if (P.bKeyAdditive > 0.5) {
    kept = select(keepBacking(k), 1.0 - min(backingShare(k), 1.0) * min(P.bKey, 1.0), P.bKey > 0.0);
  }
  return kept;
}

// The key signal a delay of dx samples and dy lines away, sliced. The edge
// generator has a comparator of its own on the key, so a part key, a shadow
// left on the fill or a strand keyed part way, reads as backing and grows no
// edge. The keyer blanks its key outside the active picture, so a tap that
// lands in blanking reads as backing too and the frame's own edges never grow
// a border.
//
// The taps read the key without B's feed damage. The comparator above slices
// it hard enough that chatter would barely reach the edge, and demodulating
// the damage at every tap measured about 0.9 ms on extrude.
fn edgeTap(at: i32, dx: i32, dy: i32, phase: f32) -> f32 {
  let idx = at + dx + dy * i32(SPL);
  let u = clampIdx(idx);
  let s = u % SPL;
  let row = u / SPL;
  var kept = 0.0;
  if (s >= ACTIVE_START && s < ACTIVE_START + ACTIVE_W && row >= ACTIVE_TOP && row < ACTIVE_TOP + ACTIVE_H) {
    kept = smoothstep(0.7, 0.9, keptBy(keyOf(idx, phase, false)));
  }
  return kept;
}

// A switcher's key edge generator. The key is run through sample and line
// delays and the delayed copies are combined with it, and wherever a copy
// reaches past the subject the generator's own matte goes in behind it. Border
// takes the key delayed both ways along and down the picture, so the subject
// grows a rim all round. Drop shadow takes one copy, delayed down and to the
// right. Extrude takes a run of copies along that diagonal, so the subject sits
// on a solid slab. The edge inherits the key's softness and its steps, since
// it is the same signal moved.
//
// Every tap is another pass through the keyer at that position, so border
// costs eight and extrude eight; it is evaluated only while switched on.
//
// Extrude gives each copy its own matte level, falling with the delay, the way
// a shaded extrusion was built: the copy nearest the subject sets the colour,
// so the slab is lit where it meets the subject and runs down into shadow at
// its far end. The result is the edge's coverage and the level its matte runs
// at there.
fn keyEdge(at: i32, phase: f32) -> vec2f {
  let h = P.bKeyEdgeH;
  let v = P.bKeyEdgeV;
  var e = 0.0;
  var lit = 0.0;
  if (P.bKeyEdge > 2.5) {
    for (var i = 1; i <= 8; i++) {
      let t = f32(i) / 8.0;
      let copy = edgeTap(at, -i32(round(h * t)), -i32(round(v * t)), phase);
      e = max(e, copy);
      lit = max(lit, copy * mix(1.0, 0.35, f32(i - 1) / 7.0));
    }
  } else if (P.bKeyEdge > 1.5) {
    e = edgeTap(at, -i32(round(h)), -i32(round(v)), phase);
  } else {
    let hx = i32(round(h));
    let vy = i32(round(v));
    let hd = i32(round(h * 0.71));
    let vd = i32(round(v * 0.71));
    e = max(max(edgeTap(at, hx, 0, phase), edgeTap(at, -hx, 0, phase)),
      max(edgeTap(at, 0, vy, phase), edgeTap(at, 0, -vy, phase)));
    e = max(e, max(max(edgeTap(at, hd, vd, phase), edgeTap(at, -hd, vd, phase)),
      max(edgeTap(at, hd, -vd, phase), edgeTap(at, -hd, -vd, phase))));
  }
  if (P.bKeyEdge < 2.5) {
    lit = e;
  }
  return vec2f(e, lit / max(e, 1e-4));
}

// A flat field from one of the box's matte generators: luma plus quadrature
// chroma on the house carrier, so it is a real encoded colour that dot-crawls
// and gets demodulated like any other.
fn matteOf(n: u32, y: f32, hue: f32, sat: f32) -> f32 {
  let sc = carrier(n, P.frame);
  return IRE_BLACK + VIDEO_RANGE * (y + sat * (cos(hue) * sc.x + sin(hue) * sc.y));
}

// The store's output through a bandpass at fsc along the line: x[i] less the
// mean of the samples a half cycle either side, which passes sin^2 of the
// frequency, 1 at fsc and 0 at DC.
fn storeBand(i: i32) -> f32 {
  return 0.5 * loopBus[clampIdx(i)]
    - 0.25 * (loopBus[clampIdx(i - 2)] + loopBus[clampIdx(i + 2)]);
}

// The chroma at sample i, separated the way a frame sync's comb filter does it.
// The subcarrier inverts from one line to the next, so the band less the mean
// of the lines above and below keeps chroma whole and cancels luma that does
// not change down the picture, so fine horizontal detail survives a trim
// applied every generation.
fn storeChroma(i: i32) -> f32 {
  let line = i32(SPL);
  return 0.5 * storeBand(i)
    - 0.25 * (storeBand(i - line) + storeBand(i + line));
}

// The frame store's output proc amp, as on any frame synchronizer, feeding the
// keyer's fill. Its hue trim is a phase shifter on the chroma band. At 4x fsc
// the quadrature is the band's difference across a sample either side, exact in
// phase at every frequency, so the trim turns the colour without moving the
// picture. The store records the keyer's output, so on the loop bus every
// generation of copies passes through the trim once more and turns a step
// further round the wheel, the frozen background with them. Neither the band
// nor the quadrature gains above 1 anywhere, so a fill that goes round the
// store hundreds of times only softens.
//
// Colour framing is the sync's other job: a frame read out on the other
// subcarrier phase from the one it was written on gets its chroma inverted, so
// what leaves the store is in step with the frame it joins. That is a half turn
// added to the trim on those frames.
fn storeOut(n: u32) -> f32 {
  let turn = P.bKeyFillHue + PI * P.bKeyFillFlip;
  if (turn == 0.0) {
    return loopBus[n];
  }
  let i = i32(n);
  let c = storeChroma(i);
  let q = 0.5 * (storeChroma(i - 1) - storeChroma(i + 1));
  return loopBus[n] + (cos(turn) - 1.0) * c - sin(turn) * q;
}

// The keyer's fill input: what shows through the hole the key cut. A real keyer
// has this as a connector on the back. Program A and the loop bus are other
// pictures, and the matte is the box's own generator, a flat field on the house
// carrier. Freeze reads the same frame store as the loop bus; the engine stops
// the store recording while freeze holds (framestore.ts).
//
// Genlocked path only, and that is mechanical rather than a shortcut: a fill is
// what sits *behind* the foreground, which needs a crossfade to have a behind.
// The dirty sum has no layers — both signals are on the wire at once — so there
// the key gates B's contribution and the program is simply always present.
fn keyFill(program: f32, n: u32) -> f32 {
  if (P.bKeyFill > 1.5) {
    return mix(storeOut(n), program, P.bKeyFillMixA);
  }
  if (P.bKeyFill > 0.5) {
    return matteOf(n, P.bKeyMatteY, P.bKeyMatteHue, P.bKeyMatteSat);
  }
  return program;
}

// Stray capacitance across a closed fader. The leak path is a small capacitor,
// so what it passes is the derivative of B: its subcarrier and its edges, never
// its flat areas. `prev` is B one sample earlier, taken the same way as `now`.
fn leakOf(now: f32, prev: f32) -> f32 {
  return P.bLeak * 0.5 * (now - prev);
}

// Which source the cut relay is passing at this sample. A worn relay's
// contacts bounce as they make: for a while after the seam the bus chatters
// between A, B and neither, in runs a few microseconds to a line long, and the
// runs settle onto B as the bounce dies away. The relay throws every frame, so
// it bounces every frame, with fresh runs each time.
const XP_A = 0u;
const XP_B = 1u;
const XP_OPEN = 2u;
const BOUNCE_LINES = 40.0;

fn crosspoint(n: u32, row: u32, s: u32, cutN: u32) -> u32 {
  var xp = XP_A;
  if (P.busCut > 0.0 && n >= cutN) {
    xp = XP_B;
    let q = f32(n - cutN) / max(P.busBounce * BOUNCE_LINES * f32(SPL), 1.0);
    if (q < 1.0) {
      let lh = pcg(row * 2246822519u + P.frame * 3266489917u + 0xb0u);
      let run = 8u + pcg(lh) % 160u;
      let seg = (s + pcg(lh ^ 0x55u) % run) / run;
      let r = rand01(pcg(lh ^ (seg * 668265263u)));
      let toB = 0.4 + 0.6 * q;
      let open = 0.2 * (1.0 - q);
      xp = select(select(XP_A, XP_B, r < toB), XP_OPEN, r > 1.0 - open);
    }
  }
  return xp;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;
  let row = gid.y;
  if (s >= SPL || row >= NLINES) {
    return;
  }
  let n = row * SPL + s;

  // The bus cut: a relay, or a cheap A/B box pressed wherever the scan happened
  // to be. From this sample of the frame to the end, the whole bus — sync,
  // burst and blanking as well as picture — is B's, so the receiver is handed
  // two signals' timing in one frame and has to find sync across the seam. It
  // is a position in raster time on the output, not in the picture, which is
  // why it can land half way along a line.
  let cutN = u32(round((1.0 - clamp(P.busCut, 0.0, 1.0)) * f32(SPL * NLINES)));
  let xp = crosspoint(n, row, s, cutN);
  let taken = xp == XP_B;
  let opened = xp == XP_OPEN;

  let a = comp[n];
  let inActive = s >= ACTIVE_START && s < ACTIVE_START + ACTIVE_W &&
    row >= ACTIVE_TOP && row < ACTIVE_TOP + ACTIVE_H;
  // picture coordinates, shared by the wipe pattern and the PiP window below
  let u = (f32(s) - f32(ACTIVE_START)) / f32(ACTIVE_W);
  let v = (f32(row) - f32(ACTIVE_TOP)) / f32(ACTIVE_H);

  // Wipe pattern generator, running on the output (house) raster. A wipe is a
  // pattern across the *picture*, so it is only evaluated inside active video
  // and blanking is left wide open at gate = 1.
  //
  // That distinction is load-bearing on the dirty path. Gating blanking down
  // with the picture took B's sync tips, burst and field pulses out of the sum,
  // which quietly switched off the sync fight — the entire point of a
  // non-genlocked mix — the moment a wipe was engaged; the "wipe fight" preset
  // could not do what its name says. The genlocked branch writes active video
  // only anyway, so a switcher still keeps its blanking on the program bus.
  var gate = 1.0;
  if (P.wipeMode > 0.5 && inActive) {
    var d = P.wipePos - u;
    if (P.wipeMode > 1.5 && P.wipeMode < 2.5) {
      d = P.wipePos - v;
    } else if (P.wipeMode > 2.5 && P.wipeMode < 3.5) {
      d = P.wipePos - max(abs(u - 0.5), abs(v - 0.5)) * 2.0;
    } else if (P.wipeMode > 3.5) {
      d = P.wipePos - (abs(u - 0.5) + abs(v - 0.5));
    }
    gate = smoothstep(-max(P.wipeSoft, 0.002), max(P.wipeSoft, 0.002), d);
  }

  if (P.bGenlock > 0.5) {
    // Clean switcher: crossfade genlocked B over A on active video only; sync,
    // burst and blanking stay on the program bus. bGain is the fader level, the
    // wipe gate shapes it spatially — so B replaces A instead of summing. B
    // arrives from encode_composite_b house-locked (and through feedB when its
    // faults are up), so a scrambled or ringing B survives the clean dissolve
    // — the TBC implied by genlock strips timing damage, not amplitude damage.
    if (inActive) {
      var g = gate;
      var fill = bComp[n];
      // Where B's picture is for this sample, on B's raster, which the keyer
      // reads from as well as the fill.
      var at = i32(n);
      var frac = 0.0;
      // The genlock's capture range. B's own clock wanders, and the lock pulls
      // it back onto the house raster only while the error is inside the range
      // — a TBC has a window, not infinite reach. Where the error is past it
      // the line is not held, and B arrives where its own clock put it: the
      // waveform is resampled at the displaced position, so the picture tears
      // sideways and the carrier it brings rotates against the house burst.
      // The error runs linearly between the top of the frame and the bottom, so
      // the lines that have lost lock form a band, and the band moves as the
      // wander does.
      if (P.bWanderTop != 0.0 || P.bWanderBottom != 0.0) {
        let e = mix(P.bWanderTop, P.bWanderBottom, v);
        if (abs(e) > P.bCapture) {
          let spl = f32(SPL);
          let sp = f32(s) - e;
          let su = sp - floor(sp / spl) * spl;
          let si = u32(su);
          at = i32(row * SPL + si);
          frac = su - f32(si);
          fill = catmull(bComp[clampIdx(at - 1)], bComp[clampIdx(at)], bComp[clampIdx(at + 1)], bComp[clampIdx(at + 2)], frac);
        }
      }
      // What sits behind B. Program A unless the keyer is actually cutting, and
      // that condition is the point: the fill is a connector on the *keyer*, so
      // with the key at zero the mixer is a plain A/B crossfade and the box in
      // front of it is out of circuit. Substituting unconditionally made the
      // fader and the wipe reveal the matte generator — or the loop bus — in
      // place of program A, which is not a look anyone patched, and left an
      // unloaded keyer able to take A off the bus entirely.
      var behind = a;
      if (P.bKey != 0.0) {
        // Genlocked and held, B sits on the house raster and its carrier
        // carries only the proc-amp hue trim, so the backing holds still and
        // the suppressor can null it flat. On a line that has lost lock the key
        // tears sideways with the picture.
        let phase = busPhase(at, n, frac, P.bHue);
        let k = keyOf(at, phase, true);
        behind = keyFill(a, n);
        if (P.bKeyEdge > 0.5) {
          let edge = keyEdge(at, phase);
          let edgeMatte = matteOf(n, P.bKeyEdgeY * edge.y, P.bKeyEdgeHue, P.bKeyEdgeSat * edge.y);
          behind = mix(behind, edgeMatte, edge.x);
        }
        if (P.bKeyAdditive > 0.5) {
          if (P.bKey > 0.0) {
            let share = min(backingShare(k), 1.0) * min(P.bKey, 1.0);
            fill = subtractBacking(fill, k, at, n) + share * (behind - IRE_BLACK);
          } else {
            g = g * keepBacking(k);
          }
        } else {
          g = g * k.gate;
          if (P.bKeySpill > 0.0) {
            fill = fill - suppress(k.spill, n);
          }
        }
      }
      comp[n] = mix(behind, fill, clamp(g * P.bGain, 0.0, 1.0));
    }
    // Genlocked, B is on the house raster, so the relay takes it as it stands.
    if (taken) {
      comp[n] = bComp[n];
    } else if (opened) {
      comp[n] = openInput(n, P.frame, 104u);
    } else if (P.bLeak > 0.0) {
      comp[n] += leakOf(bComp[n], bComp[clampIdx(i32(n) - 1)]);
    }
  } else {
    // Dirty sum: B free-runs. Its raster position for this output sample is the
    // accumulated horizontal slip plus per-line skew, and vertical roll. The
    // pause button lives upstream in feedB — a paused deck's scatter and
    // mistrack stripe are damage on B's own raster, which is what makes the
    // stripe roll with B's picture through this resample instead of parking
    // on the output raster.
    let spl = f32(SPL);
    let sp = f32(s) + P.bShift0 + P.bShiftLine * f32(row);
    let su = sp - floor(sp / spl) * spl;
    let si = u32(su);
    let frac = su - f32(si);
    let srow = wrapRow(i32(row) + i32(floor(P.bRowOff)));
    let np = i32(srow * SPL + si);
    // B is a real waveform now, so the slip is a genuine resample: the
    // fractional part re-times B's carrier against the house lattice, and the
    // 90-degrees-per-sample hue rotation that used to be an explicit phase
    // term falls out of the interpolation. Catmull keeps the carrier's
    // amplitude flat where linear interpolation would pump it (see prelude).
    let b = catmull(bComp[clampIdx(np - 1)], bComp[clampIdx(np)], bComp[clampIdx(np + 1)], bComp[clampIdx(np + 2)], frac);

    var g = gate;
    var fill = b;
    if (P.bKey != 0.0) {
      // The keyer slices B's chroma at B's OWN raster position, not at the
      // output sample — the same index the fill was resampled from. That is
      // what makes the key travel with B's picture through the slip and the
      // roll, instead of the subject rolling out from under a hole parked on
      // the output. (The three domains, in one line: this displacement is in
      // the signal, so the key moves with it.)
      //
      // B's carrier here is the one encode_composite_b baked in, its detune
      // walked per line, and the fractional slip turns it further against the
      // house lattice.
      //
      // The additive keyer has no layer to add a fill under here either, so on
      // this path it only subtracts: B's backing goes to black, shadows
      // included, and the sum is A wherever the backing was.
      let k = keyOf(np, busPhase(np, n, frac, P.bHue + P.bPhase0 + P.bPhaseLine * f32(srow)), true);
      if (P.bKeyAdditive > 0.5) {
        if (P.bKey > 0.0) {
          fill = subtractBacking(fill, k, np, n);
        } else {
          g = g * keepBacking(k);
        }
      } else {
        g = g * k.gate;
        if (P.bKeySpill > 0.0) {
          fill = fill - suppress(k.spill, n);
        }
      }
    }
    // Sum at the composite level; A rides its own bus fader (signed, so a
    // negative aGain inverts A into a difference key), and the ring mod
    // multiplies.
    //
    // Single-quadrant, unlike the loop's ring (fb_composite.wgsl) and the
    // synth's combiner, which are both balanced about mid-video. This product
    // keeps the DC of both inputs, so what it adds is the two pictures'
    // carriers riding a pedestal as well as their sum and difference — a diode
    // mixer rather than a doubly-balanced bridge, and the reason this knob
    // brightens as it is opened.
    //
    // Measured against the balanced form, (a - 40) * (fill - 40): the two part
    // company at the ends of the travel rather than across it. Balanced is
    // darker everywhere, since half its product falls below black and clips;
    // at bRing 1 with B's fader shut, this one floods to white where balanced
    // holds its colour; through the middle, with both faders up, they are hard
    // to tell apart. Left as it is because the pedestal is in the looks built
    // on it — switching costs a retune of `ringMix` and `supplyChaos` and moves
    // every saved board carrying bRing — and not because a mixer's ring mod is
    // unbalanced anywhere but here.
    var summed = P.aGain * a + g * (P.bGain * fill + P.bRing * a * fill * 0.01);
    // A passive pot crossfader in place of the bus faders (prelude
    // `potCrossfade`). The wipe pattern and the keyer still decide where B is
    // on the wire, so they gate B into the pot's far end.
    if (P.mixPot > 0.5) {
      summed = potCrossfade(a, g * fill, row, s, n, P.frame, 103u, P.mixPotTravel, P.mixPotSpeed)
        + g * P.bRing * a * fill * 0.01;
    }
    // The summing amplifier's own supply. Two full composites added is twice
    // the amplitude a single one was designed to carry, and until this the sum
    // went into the channel unclipped — arithmetic where the board has a
    // stage. What the stage adds is not a limit but a nonlinearity: as it runs
    // out of headroom its gain falls away, and a falling gain multiplies the
    // two signals sharing the bus by each other. So a detuned B beats against
    // A and lands products at their difference, which sits inside the chroma
    // band and comes back as colour neither source is carrying — the same
    // thing the ring mod beside it does with an explicit multiply, arriving
    // here because the box ran out of volts.
    //
    // It squashes the sum's sync tips with everything else, so the fight for
    // the line start changes character too: the deeper tip stops winning by
    // as much once both are against the rail.
    if (P.busClip > 0.0) {
      summed = softRail(
        summed,
        mix(220.0, 105.0, P.busClip),
        30.0,
        mix(-120.0, -45.0, P.busClip),
        15.0,
      );
    }
    if (taken) {
      summed = b;
    } else if (opened) {
      summed = openInput(n, P.frame, 104u);
    } else if (P.bLeak > 0.0) {
      let before = catmull(
        bComp[clampIdx(np - 2)],
        bComp[clampIdx(np - 1)],
        bComp[clampIdx(np)],
        bComp[clampIdx(np + 1)],
        frac,
      );
      summed += leakOf(b, before);
    }
    comp[n] = summed;
  }

  // Picture-in-picture: source B squeezed into a positionable window and keyed
  // over the program. Like the clean dissolve above, the inset is re-encoded
  // with the HOUSE carrier (genlocked, as a DVE re-times it through its frame
  // store) — so it dot-crawls but doesn't chroma-beat, and it sits rock-steady
  // where B's own sync would otherwise fight. Active picture only; blanking,
  // sync and burst stay on the program bus.
  if (P.pipMix > 0.001 && inActive) {
    let x0 = P.pipX - 0.5 * P.pipW;
    let y0 = P.pipY - 0.5 * P.pipH;
    // signed distance to the nearest window edge: >0 inside, grows toward center
    let dIn = min(min(u - x0, x0 + P.pipW - u), min(v - y0, y0 + P.pipH - v));
    let soft = max(P.pipSoft, 0.0005);
    let key = smoothstep(0.0, soft, dIn);
    if (key > 0.0) {
      // remap the window onto B's full active picture, then re-encode chroma
      let bu = clamp((u - x0) / P.pipW, 0.0, 1.0);
      let bv = clamp((v - y0) / P.pipH, 0.0, 1.0);
      let bsi = ACTIVE_START + u32(bu * f32(ACTIVE_W - 1u));
      let bsrow = ACTIVE_TOP + u32(bv * f32(ACTIVE_H - 1u));
      let bnp = bsrow * SPL + bsi;
      let bp = encodeBHouse(n, bnp);
      // matte border: a solid frame just inside the window edge
      let isBorder = dIn < P.pipBorder;
      let inset = select(bp, IRE_BLACK + VIDEO_RANGE * 0.9, isBorder);
      // luma key: drop the inset where B's own luma crosses the slice, so a
      // dark/bright matte in B lets the program show through (the border stays
      // solid). Negative key inverts which side is kept.
      var kg = 1.0;
      if (P.pipKey != 0.0) {
        var g = smoothstep(P.pipKeyLevel - P.pipKeySoft, P.pipKeyLevel + P.pipKeySoft, wireLumaBAt(bnp));
        if (P.pipKey < 0.0) {
          g = 1.0 - g;
        }
        kg = select(mix(1.0, g, abs(P.pipKey)), 1.0, isBorder);
      }
      comp[n] = mix(comp[n], inset, key * P.pipMix * kg);
    }
  }
}
