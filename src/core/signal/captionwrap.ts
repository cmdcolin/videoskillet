// Thirty-two columns is what line 21 carries and what every caption was.
export const CC_COLS = 32

// The rows a caption occupies: each paragraph word-wrapped to the page width,
// and a word wider than the page broken across rows. The encoder rolls the page
// between these rows and the switcher's generator draws the same ones, so both
// boxes show the same words.
export function wrapCaption(text: string): string[] {
  const rows: string[] = []
  for (const para of text.split('\n')) {
    let row: string[] = []
    for (const word of para.split(' ')) {
      let letters = Array.from(word)
      if (row.length > 0 && row.length + 1 + letters.length <= CC_COLS) {
        row.push(' ', ...letters)
        continue
      }
      if (row.length > 0) rows.push(row.join(''))
      while (letters.length > CC_COLS) {
        rows.push(letters.slice(0, CC_COLS).join(''))
        letters = letters.slice(CC_COLS)
      }
      row = letters
    }
    rows.push(row.join(''))
  }
  return rows
}
