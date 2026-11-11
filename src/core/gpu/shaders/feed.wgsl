// One source's feed: the cable and head-end between that input and the mixer,
// so a fault here damages one signal alone and everything downstream — the
// other input, the sync fight, the receiver — reacts to the difference. The
// same pipeline runs this shader twice (feedA, feedB) against different
// uniform buffers: pipeline.ts packs the per-source control values into the
// standard Params fields (scramble, termination, noiseSigma, polarityFlip,
// humAmp, connectorGlitch, chromaPinOnly and the rest packFeed lists), so the mechanisms stay written in exactly one place
// and `gen` decorrelates this instance's noise from the program-bus channel's.
//
// The trap that arrangement sets: every other Params field arrives here still
// holding the *program bus's* value, because packFeed spreads the bus pack and
// overrides only what FEEDS names. A block added below that reads a field
// packFeed does not override will silently apply a program-bus knob to one
// source, and it will look like it works.
//
// Only per-sample damage, three resamples and one filter live here. The
// resamples are the paused deck's, Discret's line delay and the synth's delay
// line. The filter is the chroma bandpass a chroma pin takes its C from, and it
// runs only while the pin is in. Anything needing the rest of the FIR bank or
// the color-under path (luma bandwidth, rainbow instability) stays on the
// program bus, because duplicating that per source would triple the expensive
// work for effects whose per-source value is low.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@group(0) @binding(3) var<storage, read> synthLine: array<vec2f>;
@group(0) @binding(4) var<storage, read> filters: array<f32>;

// The termination's echo reaches this many samples back.
const ECHO_LAG = 5u;
// Snow deviates staged once per workgroup: the 1-2-1 band-limit below reads
// each neighbour's deviate, and gauss() is Box-Muller — the same redundancy
// channel.wgsl stages away.
var<workgroup> tileNs: array<f32, TILE_WG + 2u + ECHO_LAG>;
// tileOut holds the feed's output for the workgroup's samples and the ECHO_LAG
// samples before them.
var<workgroup> tileOut: array<f32, TILE_WG + ECHO_LAG>;
// The chroma bandpass's half-width, in samples.
const BP_REACH = (CHROMA_BP_TAPS - 1u) / 2u;
// The capacitor's sum reads each sample beside the one two before it.
const CAP_PAD = CAP_REACH + 1u;
// tileDeck holds the deck half's output from DECK_PAD samples before the
// workgroup's first sample to BP_REACH after its last, which covers the
// termination's echo, the capacitor's charge and the chroma bandpass around
// every sample the cable half reads.
const DECK_PAD = ECHO_LAG + CAP_PAD;
var<workgroup> tileDeck: array<f32, TILE_WG + DECK_PAD + BP_REACH>;

// tapeAt gives the tape at sample i as the head-end sent it to be recorded. A
// premium channel is scrambled per channel, so each feed scrambles its own
// input, with the mechanism in the prelude, shared with the program-bus copy in
// channel.wgsl. Line-delay scrambling (prelude `discretDelay`) reads a line's
// picture from earlier on the line, and sync, blanking and burst keep their
// place; the line's start comes out of the delay as the blanking that went in
// ahead of the picture. The deck reads this, so the sync gate follows the sync
// tip wherever a held deck or the synth's delay line displaces it.
fn tapeAt(i: i32) -> f32 {
  let ci = clampIdx(i);
  let row = ci / SPL;
  let s = ci % SPL;
  let inPicture = s >= ACTIVE_START && s < ACTIVE_START + ACTIVE_W
    && row >= ACTIVE_TOP && row < ACTIVE_TOP + ACTIVE_H;
  var v = src[ci];
  if (u32(P.scrambleMode + 0.5) == 7u && P.scramble > 0.0 && inPicture) {
    let at = f32(ci) - discretDelay(row, P.srcFrame, P.scramble);
    let a0 = i32(floor(at));
    v = select(
      catmull(src[clampIdx(a0 - 1)], src[clampIdx(a0)], src[clampIdx(a0 + 1)], src[clampIdx(a0 + 2)], at - f32(a0)),
      IRE_BLANK,
      at < f32(row * SPL + ACTIVE_START),
    );
  }
  return scrambleAt(v, row, s, P.scramble, P.scrambleMode, P.srcFrame);
}

// deckAt gives one sample of the feed's deck half: the head-end, the deck and
// the synth's boxes, which all sit ahead of the lead into the mixer.
fn deckAt(n: u32) -> f32 {
  let row = n / SPL;
  let s = n % SPL;
  // This feed's deck paused (bPause/bPauseBar/bShift0/bRowOff carry whichever
  // deck's values pipeline.ts packed — A's servo state for feedA, B's for
  // feedB on the dirty path, and zeros for feedB genlocked, where the TBC
  // strips B's timing damage). The drum re-reads
  // one track with the capstan servo defeated: each line's timing scatters on
  // its own around the slow wander, the whole raster hops vertically when the
  // servo hunts, and the head loses the track approaching the mistrack stripe
  // — a coherent hook dragging nearby lines sideways. The waveform moves whole
  // — sync, burst and all — so the receiver's PLL hunts line by line and hue
  // wobbles with the displacement, exactly what a no-TBC deck hands a set.
  //
  // srcS/srcRow are where on this deck's own tape the output sample is reading
  // from — with the deck playing and no delay line, the sample itself. They
  // exist because everything that happened UPSTREAM of the deck has to be
  // evaluated there rather than at the output position: the head-end scrambled
  // this before it was ever recorded, and a dropout is missing oxide at a fixed
  // place on the tape. Read at the output position, that damage stands still on
  // the glass while the picture it belongs to scatters around it, and the
  // scrambler lifts whatever has drifted under the sync gate instead of the sync
  // tip — measurably, a third of the lines kept a full-depth tip under a held
  // deck.
  // The cable faults further down deliberately keep the output raster: those
  // happen after the deck, on the way to the mixer.
  var srcS = s;
  var srcRow = row;
  var out: f32;
  var cv = 0.0;
  if (P.synthDelay > 0.0 || P.synthVca > 0.0 || P.synthSync > 0.0) {
    cv = synthOut(row, s, synthPatch(P), 0.0, synthLine[row]);
  }
  // The synth's output driving a delay line in A's cable: the whole composite,
  // sync and burst too, comes out late by an amount that follows the synth's
  // level. Where the delay changes along a line the picture is stretched or
  // squeezed, and the subcarrier slides against the burst, so the hue turns
  // wherever the delay moves. The deck's output enters the delay line, so the
  // tape is read that much earlier, and a paused deck's resample adds to it.
  let lag = P.synthDelay * cv;
  if (P.bPause > 0.0) {
    let dr = abs(f32(row) - P.bPauseBar);
    let dBar = min(dr, f32(NLINES) - dr);
    let off = P.bShift0
      + P.bPause * 7.0 * (rand01(pcg(row * 613u + P.frame * 40961u)) - 0.5)
      + P.bPause * 28.0 * exp(-dBar / 9.0);
    let spl = f32(SPL);
    var su = f32(s) + off - lag;
    su = su - floor(su / spl) * spl;
    srcS = u32(su);
    let frac = su - f32(srcS);
    // floor, not truncation: the servo's hunt only walks one way today, but
    // i32() of a negative float rounds toward zero, so a two-sided hunt would
    // land a line short on one side alone. mix_b floors the same quantity.
    srcRow = wrapRow(i32(row) + i32(floor(P.bRowOff)));
    let np = i32(srcRow * SPL + srcS);
    out = catmull(tapeAt(np - 1), tapeAt(np), tapeAt(np + 1), tapeAt(np + 2), frac);
    // The mistrack stripe itself: where the parked head sweeps off the
    // recorded track the RF nulls and the deck's detector hands back snow —
    // sync, burst and all, since the null does not care what it lands on.
    let half = 5.0 + 13.0 * P.bPause;
    if (dBar < half) {
      let edge = 1.0 - dBar / half;
      // the deck's RF detector, which keeps running: this snow is live even
      // while the tape is parked, unlike the dropouts below
      out = rfNull(out, edge * 1.6 * P.bPause, n ^ pcg(P.frame * 15187u + row * 5u));
    }
  } else if (lag > 0.0) {
    let at = f32(n) - lag;
    let a0 = i32(floor(at));
    out = catmull(tapeAt(a0 - 1), tapeAt(a0), tapeAt(a0 + 1), tapeAt(a0 + 2), at - f32(a0));
    let tape = clampIdx(a0);
    srcRow = tape / SPL;
    srcS = tape % SPL;
  } else {
    out = tapeAt(i32(n));
  }
  let srcN = srcRow * SPL + srcS;

  // Dropouts on this deck's own tape: shed oxide, so for a moment the head
  // reads nothing and the detector hands back snow. Same event model as the
  // program-bus copy in channel.wgsl, but seeded inline (this pass has no
  // lineParams) and uncompensated — the feeds model cheap front ends, and the
  // deck with the delay-line compensator sits on the program bus.
  //
  // Placed and seeded on the tape, not the screen: the damage is in the oxide,
  // so a paused deck re-reading one track has to hand back the same gaps, in
  // the same places, carried by the same resample as the picture around them.
  // On frame time and the output raster a held picture sparkled with a fresh
  // set of streaks sixty times a second and each one stood still while the
  // frame jittered — an electrical fault, not a worn tape.
  if (P.dropoutRate > 0.0) {
    let h = pcg((srcRow * 7621u) ^ (P.srcFrame * 2654435761u + P.gen * 97911u));
    if (rand01(h) < P.dropoutRate / f32(NLINES)) {
      let start = f32(pcg(h ^ 0x51ed270bu) % SPL);
      let len = P.dropoutLen * (0.4 + 1.2 * rand01(h ^ 0x9134u));
      let fs = f32(srcS);
      if (fs >= start && fs < start + len) {
        out = dropoutNull(out, 0.95, srcN ^ pcg(P.srcFrame * 977u + P.gen * 7919u));
      }
    }
  }

  // The synth's output on a VCA in A's cable, after the delay line. It scales
  // the whole waveform about blanking, so where the synth is high the picture
  // dims and its sync tips shrink with it. Once they fall short of the set's
  // slicer the set loses lock, and its AGC chases the level up and down.
  if (P.synthVca > 0.0) {
    out = IRE_BLANK + (out - IRE_BLANK) * (1.0 - P.synthVca * cv);
  }
  // The synth's output summed into A's cable upside down, with nothing to clip
  // it at black. Dark picture where the synth is high goes below the set's
  // slicer and arrives as sync.
  if (P.synthSync > 0.0) {
    out = out - P.synthSync * cv;
  }
  return out;
}

// The deck's S-video out, as the feed's lead hands it to the mixer's jack.
// The synth's boxes count as part of the deck: they sit ahead of its
// separator, so the bandpass strips the synth's slow sync along with the luma.
// The deck separates C from its own composite with a chroma bandpass, so C
// also carries the luma detail near the subcarrier. With the pin in, the
// sample at tile index i is pinned against the bandpass of the deck half
// around it.
//
// A lead wired as the mirror image of its plug puts an adapter's chroma
// capacitor in series with Y, so luma and sync arrive as their edges and C
// arrives direct. The capacitor's charge is a one-pole lowpass of Y, and
// averaging samples half a subcarrier cycle apart keeps C out of it.
//
// A half-seated plug opens one signal pin in bands of lines (connector modes 3
// and 4), and an open pin there is that pin fully out.
fn leadAt(i: u32, row: u32) -> f32 {
  let v = tileDeck[i];
  var out = v;
  var load = 1.0;
  if (P.seriesCap > 0.0) {
    var w = 0.5 * (1.0 - P.seriesCap) / (1.0 - pow(P.seriesCap, f32(CAP_REACH)));
    var charge = 0.0;
    for (var k = 0u; k < CAP_REACH; k = k + 1u) {
      charge = charge + w * (tileDeck[i - k] + tileDeck[i - k - 2u]);
      w = w * P.seriesCap;
    }
    load = CAP_LOAD;
    out = load * (v - charge);
  }
  var pin = P.chromaPinOnly;
  if (P.connectorMode > 2.5 && signalPinOpen(row, P.frame, P.gen, P.connectorGlitch)) {
    pin = select(1.0, -1.0, P.connectorMode > 3.5);
  }
  if (pin != 0.0) {
    var c = filters[SEC_CHROMA_BP * FILTER_STRIDE + BP_REACH] * v;
    for (var k = 0u; k < BP_REACH; k = k + 1u) {
      c = c + filters[SEC_CHROMA_BP * FILTER_STRIDE + k] * (tileDeck[i + k - BP_REACH] + tileDeck[i + BP_REACH - k]);
    }
    out = chromaPin(out, load * c, pin);
  }
  return out;
}

// cableAt carries the lead's sample v at n down the cable and through the
// plug, up to the termination. `slot` is the sample's place in the
// workgroup's noise tile. The snow and the hum reach the jack whichever pin
// touches: the snow is picked up on the C wire too, and the hum rides the
// shield.
fn cableAt(v: f32, n: u32, slot: u32) -> f32 {
  let row = n / SPL;
  let s = n % SPL;
  var out = v;

  // Additive noise (snow), 1-2-1 band-limited. Deliberately not the program
  // bus's tilted floor: the tilt is an FM discriminator's triangular noise,
  // which belongs to a deck's playback electronics, and a feed's snow is what
  // the cable out of it picks up — RF and thermal, flat across the video band.
  // (It is also a field packFeed does not override, so taking it here would be
  // the trap this file's header warns about.)
  if (P.noiseSigma > 0.0) {
    let cn = slot;
    out = out + P.noiseSigma * 0.4082 * (tileNs[cn - 1u] + 2.0 * tileNs[cn] + tileNs[cn + 1u]);
  }

  // Ground loop on this input's cable alone. A loop needs two earthed boxes
  // joined by a shield, so it is a property of one *run* — this deck's mains
  // outlet against the mixer's — and a hum bar on the program bus cannot say
  // which cable is carrying it. Injected in series along the run, so it lifts
  // this source's sync tips with its picture: the receiver's AGC and hold chase
  // A's level sixty times a second while B's sits still, and which of the two
  // wins the sync fight alternates with the hum phase — the reason a ground
  // loop in a two-deck rig rolls the picture rather than just barring it.
  //
  // Signed, because the two ends of a split-phase service are 180 degrees
  // apart: same amplitude, opposite leg, and two feeds on opposite legs push
  // their bars against each other instead of together.
  //
  // The bar rides this source's own raster, so under the dirty sum B's travels
  // with B's picture through the slip and roll while A's stays put — which is
  // what tells the two cables apart on screen.
  if (P.humAmp != 0.0) {
    out = out + P.humAmp * sin(humPhase(f32(row), P.frame));
  }

  // The plug at the mixer's input jack going intermittent, on this input alone
  // (prelude `connectorAt`). On the output raster, not the tape: the connector
  // is at the far end of the cable, downstream of everything the deck did.
  out = connectorAt(out, row, n, P.frame, P.gen, P.connectorGlitch, P.connectorMode);

  // A dirty pot clipped into this cable (prelude `potAt`), between the plug
  // and the input's terminator.
  if (P.potOhms > 0.0 || P.potSpeed > 0.0) {
    out = potAt(out, row, s, n, P.frame, P.gen, P.potOhms, P.potSpeed);
  }

  // Hard polarity flip on this feed's connector: whole waveform negated, sync
  // and burst included. Unlike a negative bus gain this holds regardless of
  // what the mixer is doing — the fault is in the cable, not the fader.
  out = mix(out, -out, P.polarityFlip);
  return out;
}

// The termination's echo is the feed's own output five samples back. A
// workgroup's first five samples need the five before its tile, which another
// workgroup computes, so while the line is open each workgroup computes those
// five again. Every stage depends only on the sample's position, so both
// copies agree. The deck half is staged once per workgroup, wide enough for
// the echo and, with the pin in, for the chroma bandpass.
@compute @workgroup_size(TILE_WG, 1, 1)
fn main(
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_id) lid: vec3u,
  @builtin(workgroup_id) wid: vec3u,
) {
  let row = wid.y;
  let n0 = row * SPL + wid.x * TILE_WG;
  if (P.noiseSigma > 0.0) {
    let ns = pcg(P.frame * 2654435761u + P.gen * 2246822519u);
    // slot i is global index n0 + i - 1 - ECHO_LAG
    for (var i = lid.x; i < TILE_WG + 2u + ECHO_LAG; i = i + TILE_WG) {
      tileNs[i] = gauss((n0 + i - 1u - ECHO_LAG) ^ ns);
    }
  }
  // tile index i is global index n0 + i - DECK_PAD
  let open = P.termination > 0.0;
  let pinned = P.chromaPinOnly != 0.0 || (P.connectorMode > 2.5 && P.connectorGlitch > 0.0);
  let back = select(select(0u, BP_REACH, pinned), CAP_PAD, P.seriesCap > 0.0);
  let lo = DECK_PAD - select(0u, ECHO_LAG, open) - back;
  let hi = DECK_PAD + TILE_WG + select(0u, BP_REACH, pinned);
  let first = lo + lid.x;
  let second = first + TILE_WG;
  let third = second + TILE_WG;
  if (first < hi) {
    tileDeck[first] = deckAt(clampIdx(i32(n0 + first) - i32(DECK_PAD)));
  }
  if (second < hi) {
    tileDeck[second] = deckAt(clampIdx(i32(n0 + second) - i32(DECK_PAD)));
  }
  if (third < hi) {
    tileDeck[third] = deckAt(clampIdx(i32(n0 + third) - i32(DECK_PAD)));
  }
  workgroupBarrier();

  let s = gid.x;
  let n = row * SPL + s;
  let live = s < SPL && row < NLINES;
  var out = 0.0;
  if (live) {
    out = cableAt(leadAt(DECK_PAD + lid.x, row), n, lid.x + 1u + ECHO_LAG);
  }

  // Cable termination fault on this feed alone (prelude `terminate`). Only an
  // open line echoes.
  var echo = 0.0;
  if (open) {
    if (lid.x < ECHO_LAG) {
      let e = max(i32(n0) - i32(ECHO_LAG) + i32(lid.x), 0);
      tileOut[lid.x] = cableAt(leadAt(DECK_PAD - ECHO_LAG + lid.x, u32(e) / SPL), u32(e), u32(e - i32(n0) + i32(1u + ECHO_LAG)));
    }
    tileOut[lid.x + ECHO_LAG] = out;
    workgroupBarrier();
    echo = tileOut[lid.x];
  }
  out = terminate(out, P.termination, echo);

  if (live) {
    dst[n] = out;
  }
}
