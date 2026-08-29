// The set's caption decoder: line 21 sliced off the signal the receiver
// actually got, and the characters that survive held in page RAM.
//
// Where this stands is the whole point. It reads `comp` after the channel has
// finished with it, so the data has been through the same noise, the same
// bandwidth and the same tape as the picture — a caption is misspelled by what
// speckles the frame. And it gates off `timing[]`, the horizontal PLL the
// picture is locked to, because that is the gate a real decoder has: a set that
// cannot hold the line cannot find the caption's data window either.
//
// What it does *not* do is paint. The page lives here and `decode` reads it on
// the set's own raster, which is why the picture can roll out from under a
// caption that does not move.
//
// One invocation, because a page is a serial machine: a character lands where
// the cursor is and moves it, and a cursor is not something threads can share.

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> comp: array<f32>;
@group(0) @binding(2) var<storage, read> timing: array<f32>;
@group(0) @binding(3) var<storage, read_write> cc: array<u32>;

// The level at the middle of one data cell. Integrated across seven samples
// rather than read at one, the way a slicer's integrator is: a decision made on
// a single sample is a decision made on a single noise deviate, and this line
// has been through everything the picture has.
fn ccCell(cell: u32, hoff: i32) -> f32 {
  let cellW = f32(ACTIVE_W) / f32(CC_CELLS);
  let mid = i32(round((f32(cell) + 0.5) * cellW)) + i32(ACTIVE_START);
  var acc = 0.0;
  for (var k = -3; k <= 3; k = k + 1) {
    acc = acc + comp[clampIdx(i32(CC_LINE * SPL) + mid + k + hoff)];
  }
  return acc / 7.0;
}

// One character off the wire: seven data bits then odd parity. A character
// whose parity does not hold comes back as the block flag alone — the value is
// not guessed at, because a wrong letter delivered confidently is worse than a
// visible hole.
fn ccChar(first: u32, hoff: i32, slice: f32) -> u32 {
  var code = 0u;
  var ones = 0u;
  for (var b = 0u; b < 7u; b = b + 1u) {
    if (ccCell(first + b, hoff) > slice) {
      code = code | (1u << b);
      ones = ones + 1u;
    }
  }
  if (ccCell(first + 7u, hoff) > slice) {
    ones = ones + 1u;
  }
  if ((ones & 1u) == 0u) {
    return CC_BLOCK;
  }
  return code;
}

// Roll up: every row climbs one, the bottom row is cleared, the cursor comes
// home. A roll-up caption is the only mode here, and this is the whole of it.
fn ccRoll() {
  for (var r = 0u; r + 1u < CC_ROWS; r = r + 1u) {
    for (var c = 0u; c < CC_COLS; c = c + 1u) {
      cc[CC_PAGE + r * CC_COLS + c] = cc[CC_PAGE + (r + 1u) * CC_COLS + c];
    }
  }
  for (var c = 0u; c < CC_COLS; c = c + 1u) {
    cc[CC_PAGE + (CC_ROWS - 1u) * CC_COLS + c] = 0u;
  }
  cc[CC_CURSOR] = 0u;
}

// A cell into the bottom row at the cursor. A row that fills simply stops
// taking characters: thirty-two columns is what the format has, and a real
// decoder had nowhere to put the thirty-third either.
fn ccPut(cell: u32) {
  let col = cc[CC_CURSOR];
  if (col >= CC_COLS) {
    return;
  }
  cc[CC_PAGE + (CC_ROWS - 1u) * CC_COLS + col] = cell | CC_SET;
  cc[CC_CURSOR] = col + 1u;
}

fn ccTake(v: u32) {
  if (v == 0u) {
    return; // the null an encoder sends when it has nothing to say
  }
  if ((v & CC_BLOCK) != 0u) {
    ccPut(CC_BLOCK);
    return;
  }
  if (v == CC_CR) {
    ccRoll();
    return;
  }
  if (v < 0x20u) {
    return; // a control code this decoder has no behaviour for
  }
  ccPut(v - 0x20u);
}

@compute @workgroup_size(1)
fn main() {
  if (P.cc == 0.0) {
    return;
  }
  let hoff = i32(round(timing[CC_LINE]));

  // The run-in is seven cycles of known amplitude ahead of unknown data, and
  // it is what the slicer's threshold comes from — so a level the AGC has
  // moved, or a line the tape has half eaten, is measured rather than assumed.
  //
  // Scanned sample by sample rather than through ccCell: the run-in is a sine,
  // and every one of its cell centres sits on the midpoint being measured. Read
  // there it would come back flat on a perfect signal.
  let cellW = f32(ACTIVE_W) / f32(CC_CELLS);
  let base = i32(CC_LINE * SPL) + i32(ACTIVE_START) + hoff;
  var lo = 1e9;
  var hi = -1e9;
  for (var k = 0; k < i32(round(7.0 * cellW)); k = k + 1) {
    let v = comp[clampIdx(base + k)];
    lo = min(lo, v);
    hi = max(hi, v);
  }
  // Nothing with the shape of a run-in on this line: no caption to read, and
  // the page keeps what it had. That is what leaves the last caption sitting on
  // screen when the signal dies rather than blanking it.
  if (hi - lo < 12.0) {
    return;
  }
  let slice = 0.5 * (lo + hi);

  // Three start bits, low-low-high. Requiring them is what stops snow being
  // read as text: noise clears a threshold about half the time, and without a
  // framing check every dead channel would type.
  if (ccCell(9u, hoff) > slice || ccCell(10u, hoff) > slice
      || ccCell(11u, hoff) < slice) {
    return;
  }

  ccTake(ccChar(12u, hoff, slice));
  ccTake(ccChar(20u, hoff, slice));
}
