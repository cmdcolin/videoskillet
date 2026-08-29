// A character generator standing at the switcher, keyed onto the program bus.
//
// The other end of the same words. `caption.wgsl` is a decoder inside the set
// recovering text off line 21; this is the box that keyed the same text into
// the picture before it ever left the plant, which is what an open caption was.
// Run both and they come apart as the chain degrades: this one is picture, so
// it is torn and smeared and rainbowed by everything downstream and never
// misspelled, and the closed one is data, so it is spelled wrong and never
// moves.
//
// What makes a CG a CG rather than an overlay is that it puts out **two wires,
// fill and key**, and every bent-chyron artifact is those two coming apart. The
// key is generated at the character's own edges; the fill is video. Trim the
// timing between them and the matte slides off the letters.
//
// It writes into the program composite in place, which is safe because every
// thread reads and writes its own sample — the key's neighbourhood is read out
// of the font ROM, not out of the signal.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> comp: array<f32>;
@group(0) @binding(2) var<storage, read> cg: array<u32>;

// This box's own font ROM, with its own pin held on it. The caption decoder in
// the set has a chip of its own and a bend of its own — two boxes, so bending
// one says nothing about the other. See decode.wgsl's `romRead` for what the
// address and data buses each do; the wiring is the same chip.
fn cgRom(glyph: u32, row: u32) -> u32 {
  var addr = glyph * GLYPH_H + row;
  if (P.cgRomAddr > 0.5) {
    addr = addr | (1u << u32(P.cgRomAddr - 1.0));
  }
  var bits = cg[addr % (GLYPH_COUNT * GLYPH_H)];
  let d = i32(P.cgRomData);
  if (d > 0) {
    bits = bits | (1u << u32(d - 1));
  } else if (d < 0) {
    bits = bits & ~(1u << u32(-d - 1));
  }
  return bits;
}

// The raw key at a point on the picture: 1 inside a lit dot, 0 outside. Sampled
// analytically rather than gathered, so the key can be read at a position the
// fill is not at — which is the whole of what a timing trim does.
fn cgInk(x: f32, y: f32) -> f32 {
  let cw = P.cgScale * f32(GLYPH_W);
  let ch = P.cgScale * f32(GLYPH_H);
  let px = x - P.cgX * f32(ACTIVE_W);
  let py = y - P.cgY * f32(ACTIVE_H);
  if (px < 0.0 || py < 0.0) {
    return 0.0;
  }
  let col = u32(px / cw);
  let row = u32(py / ch);
  if (col >= CC_COLS || row >= CC_ROWS) {
    return 0.0;
  }
  let cell = cg[CC_PAGE + row * CC_COLS + col];
  if ((cell & CC_SET) == 0u) {
    return 0.0;
  }
  let gx = u32((px - f32(col) * cw) / P.cgScale);
  let gy = u32((py - f32(row) * ch) / P.cgScale);
  if (gx >= GLYPH_W || gy >= GLYPH_H) {
    return 0.0;
  }
  return f32((cgRom(cell & 0xffu, gy) >> gx) & 1u);
}

// The key through the box's own key-processing amplifier, which is narrower
// than the video path and is the only reason a key has a soft edge at all.
//
// Horizontal only, and that asymmetry is not a shortcut — it is the same one
// the chroma keyer has, for the same reason. This is a line of signal, not a
// picture: there is no vertical neighbour on this wire.
fn cgKeyAt(x: f32, y: f32) -> f32 {
  if (P.cgSoft < 0.5) {
    return cgInk(x, y);
  }
  var acc = 0.0;
  for (var k = -3; k <= 3; k = k + 1) {
    acc = acc + cgInk(x + f32(k) * P.cgSoft / 3.0, y);
  }
  return acc / 7.0;
}

// The comparator the processed key is sliced at. On a photograph this is where
// a matte's edge lands; on type it is stroke weight — down, and thin strokes
// fuse and the line grows a halo; up, and stems drop out of the middle of
// words.
fn cgSlice(k: f32) -> f32 {
  return smoothstep(P.cgClip, min(P.cgClip + 0.15, 1.0), k);
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let row = gid.y;
  let s = gid.x;
  if (s >= SPL) {
    return;
  }
  // Active picture only. A CG keys into video and has no business anywhere near
  // sync — a box that stamped over the vertical interval would be a box that
  // stopped the set locking, which is a different fault entirely.
  if (row < ACTIVE_TOP || row >= ACTIVE_TOP + ACTIVE_H
      || s < ACTIVE_START || s >= ACTIVE_START + ACTIVE_W) {
    return;
  }
  let x = f32(s - ACTIVE_START);
  let y = f32(row - ACTIVE_TOP);

  // The fill wire: the characters as *video*, black where they are not. This is
  // the half that makes the box a keyer rather than an overlay, and it is why
  // the trim below has anything to do.
  //
  // The fill is authored in IRE and can be pushed past peak white, which is not
  // a guard rail left off: type at full swing is the harshest thing a composite
  // path ever carries, and everything downstream that reacts to level — the
  // AGC, the tape, the sound detector's limiter — reacts to it here.
  let fill = mix(IRE_BLACK, P.cgFill, cgSlice(cgKeyAt(x, y)));

  // The key wire, read at its own position. The key path and the video path are
  // different lengths of circuit and a real box trims the difference out; what
  // a mis-set trim does to *type* is the thing worth having. Where the key is
  // open and the fill has not arrived, the box hands over its own black — so
  // one side of every stem grows a hard shadow. Where the fill is lit and the
  // key has closed, program shows straight through the letter. Far enough out
  // and the two shapes stop overlapping at all, which leaves an outline with
  // nothing inside it.
  let kx = x + P.cgKeyDelay;
  var matte = cgSlice(cgKeyAt(kx, y));

  // The edge generator, OR-ed into the key rather than drawn separately —
  // which is how the box made a border out of one extra tap. The matte widens
  // to the shadow's shape and the fill is black out there, so the shadow is
  // what the widened hole shows. Bending the two delays apart is what detaches
  // it and walks it in front of the type instead of behind it.
  if (P.cgEdgeX != 0.0 || P.cgEdgeY != 0.0) {
    matte = max(matte, cgSlice(cgKeyAt(kx - P.cgEdgeX, y - P.cgEdgeY)));
  }
  if (P.cgInvert > 0.5) {
    // A downstream keyer inverted cuts letter-shaped holes in a full-frame
    // fill, and it does that across the whole raster rather than inside the
    // block — the key's domain is the picture, not the type.
    matte = 1.0 - matte;
  }

  let n = row * SPL + s;
  comp[n] = mix(comp[n], fill, P.cgMix * matte);
}
