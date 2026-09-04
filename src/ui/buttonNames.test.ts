import { describe, expect, it } from 'vitest'

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// Every button says what it does in words.
//
// A screen reader and a browsing agent reach for the same thing — the
// accessible name — and both are handed punctuation by a button whose entire
// content is `×`. It announces as "times", it matches no search for "unbind",
// and on a panel with two of them in a row there is nothing to tell them apart.
// The MIDI rack had exactly that pair.
//
// So the rule this holds: a button's content has to contain letters somewhere,
// or the element has to carry an `aria-label` or a `title`. An icon component
// and a glyph are the same case — `<GearIcon />` renders an `aria-hidden` svg,
// which is right, and leaves the button nameless, which is not.
//
// Source scanning rather than a rendered tree, for the reason cssModules.test.ts
// scans source: the question is static, and rendering these components means a
// GPUDevice.

const SRC = resolve(import.meta.dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const path = join(dir, e.name)
    return e.isDirectory()
      ? sourceFiles(path)
      : e.name.endsWith('.tsx')
        ? [path]
        : []
  })
}

interface Button {
  body: string
  named: boolean
  line: number
}

// The open tag ends at the first `>` outside a JSX expression: attribute values
// hold `>` freely (`() => run()` on every handler in here), so counting braces
// is what separates the tag from its own arrow functions.
function buttons(src: string): Button[] {
  const out: Button[] = []
  for (const m of src.matchAll(/<button\b/g)) {
    const start = m.index
    let i = start + '<button'.length
    let depth = 0
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    const open = src.slice(start, i + 1)
    const close = src.indexOf('</button>', i)
    out.push({
      body: open.endsWith('/>') || close < 0 ? '' : src.slice(i + 1, close),
      named: /\baria-label(?:ledby)?[=\s]|\btitle=/.test(open),
      line: src.slice(0, start).split('\n').length,
    })
  }
  return out
}

// Letters the button can speak. An icon element contributes none — it is
// `aria-hidden` by construction — and neither does the markup around the text,
// so both come out before the question is asked. What stays is the raw text and
// anything a `{}` expression could resolve to, which is as far as a static read
// can go: a label reached through a variable counts, and that is the right way
// to be wrong here.
function speakable(body: string): string {
  return body
    .replaceAll(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replaceAll(/<[A-Za-z][\w.]*Icon\b[^>]*\/>/g, ' ')
    .replaceAll(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\bclassName\b|\bstyles\b|\bcx\b|\bkey=/g, ' ')
}

const files = sourceFiles(SRC)

describe('button names', () => {
  it('finds the buttons', () => {
    // A scan that silently matches nothing passes every file under it.
    const n = files.reduce(
      (sum, f) => sum + buttons(readFileSync(f, 'utf8')).length,
      0,
    )
    expect(n).toBeGreaterThan(100)
  })

  it.each(files.map(f => relative(SRC, f)))('%s names every button', rel => {
    const src = readFileSync(join(SRC, rel), 'utf8')
    const nameless = buttons(src)
      .filter(b => !b.named && !/[A-Za-z]/.test(speakable(b.body)))
      .map(b => `${rel}:${b.line}`)
    expect(nameless).toEqual([])
  })
})
