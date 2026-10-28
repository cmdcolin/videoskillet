// Thirty-two columns is what line 21 carries and what every caption was.
export const CC_COLS = 32

// Break text into lines of at most `cols` characters. Explicit newlines are
// kept (including empty ones, so a deliberate gap between stanzas survives) and
// a word longer than the line is broken rather than blowing past the margin.
//
// Everything here counts *characters*, never `.length`. A sextant is one cell
// of a teletype page and two UTF-16 units of the string, so measuring in code
// units makes a drawn row look twice as wide as it is: a row that came off a
// 40-cell grid — and therefore fits by construction — would be sent down the
// re-flow path below, which collapses the runs of spaces that are the picture
// and snaps the overflow onto a line of its own, shoving everything under it a
// row further down the page with every stroke. Slicing by code units would be
// worse still, cutting a character between its halves.
export function wrapText(text: string, cols: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    // A line that already fits is taken exactly as typed. Re-flowing it would
    // be invisible in prose and fatal in a drawing, where the runs of spaces
    // between the blocks are the picture.
    const chars = Array.from(para)
    if (chars.length <= cols) {
      out.push(para)
      continue
    }
    let line: string[] = []
    for (const word of para.split(/\s+/).filter(w => w !== '')) {
      let rest = Array.from(word)
      while (rest.length > cols) {
        if (line.length > 0) {
          out.push(line.join(''))
          line = []
        }
        out.push(rest.slice(0, cols).join(''))
        rest = rest.slice(cols)
      }
      // An oversized word that divided evenly has nothing left to place, and
      // starting a line with it would leave a blank one behind.
      if (rest.length === 0) continue
      if (line.length === 0) line = rest
      else if (line.length + 1 + rest.length <= cols)
        line = [...line, ' ', ...rest]
      else {
        out.push(line.join(''))
        line = rest
      }
    }
    out.push(line.join(''))
  }
  return out
}

// The rows a caption occupies. The encoder rolls the page between these rows
// and the switcher's generator draws the same ones, so both boxes show the same
// words.
export const wrapCaption = (text: string): string[] => wrapText(text, CC_COLS)
