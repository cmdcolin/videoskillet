import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'

// A help string written as paragraphs used to land in its table cell with the
// newlines intact, which ends the row at the first one and turns the rest of
// the group's table into loose text. The fold that stops it lives in
// docgen.mjs, and this reads its output rather than the function, so the check
// covers whatever `pnpm docgen` last wrote.
describe('docs/EFFECTS.md', () => {
  const rows = readFileSync('docs/EFFECTS.md', 'utf8')
    .split('\n')
    .filter(l => l.startsWith('| **'))

  it('keeps every control on one row of three cells', () => {
    expect(rows.length).toBeGreaterThan(200)
    for (const row of rows) {
      expect(row.replaceAll('\\|', '').split('|')).toHaveLength(5)
    }
  })

  it('folds a multi-paragraph help into breaks', () => {
    const vbi = rows.find(r => r.startsWith('| **vbi test signals**'))
    expect(vbi).toContain('<br><br>- **lines 17-18**')
    expect(vbi).not.toContain('<br><br><br>')
  })
})
