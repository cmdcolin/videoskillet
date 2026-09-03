import { describe, expect, it } from 'vitest'

import { stripWgslComments, stripWgslLiterals } from './vite-plugin-wgsl'

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SHADER_DIR = 'src/core/gpu/shaders'

describe('stripWgslComments', () => {
  it('takes a whole-line comment down to an empty line, so the rows below keep their numbers', () => {
    const src = '// what this does\nfn main() {\n// and this\n  return;\n}'
    expect(stripWgslComments(src)).toBe('\nfn main() {\n\n  return;\n}')
  })

  it('takes a trailing comment and the space before it, and leaves the code', () => {
    expect(stripWgslComments('let x = 1;   // why one')).toBe('let x = 1;')
  })

  it('leaves a line with no comment alone, indentation included', () => {
    expect(stripWgslComments('    let x = 1;')).toBe('    let x = 1;')
  })

  it('never changes how many lines there are', () => {
    for (const file of readdirSync(SHADER_DIR).filter(f =>
      f.endsWith('.wgsl'),
    )) {
      const src = readFileSync(join(SHADER_DIR, file), 'utf8')
      expect(stripWgslComments(src).split('\n')).toHaveLength(
        src.split('\n').length,
      )
    }
  })

  // The cut is at the first `//` on the line, which is only safe while every
  // `//` in the shaders is a comment. WGSL has no string literal to hide one in,
  // and there are no block comments here, so the thing to guard is a `//`
  // arriving in code — which is what this asserts cannot be true.
  it('finds no // in the shaders that is anything but a comment', () => {
    for (const file of readdirSync(SHADER_DIR).filter(f =>
      f.endsWith('.wgsl'),
    )) {
      const src = readFileSync(join(SHADER_DIR, file), 'utf8')
      expect(src).not.toMatch(/\/\*/)
      for (const line of src.split('\n')) {
        const at = line.indexOf('//')
        if (at > 0) {
          expect(`${file}: ${line}`).toMatch(/\s\/\//)
        }
      }
    }
  })

  it('keeps every line of code in every shader', () => {
    for (const file of readdirSync(SHADER_DIR).filter(f =>
      f.endsWith('.wgsl'),
    )) {
      const src = readFileSync(join(SHADER_DIR, file), 'utf8')
      const kept = stripWgslComments(src)
      for (const line of src.split('\n')) {
        const code = line.slice(
          0,
          line.indexOf('//') === -1 ? undefined : line.indexOf('//'),
        )
        if (code.trim() !== '') {
          expect(kept).toContain(code.trimEnd())
        }
      }
    }
  })
})

describe('stripWgslLiterals', () => {
  it('strips inside a tagged literal and leaves the TypeScript around it', () => {
    const code =
      "const A = 'keep // this'\nconst P = /* wgsl */ `fn f() {} // gone\n`\n"
    const { code: out, hits } = stripWgslLiterals(code)
    expect(hits).toBe(1)
    expect(out).toContain("const A = 'keep // this'")
    expect(out).toContain('fn f() {}\n')
    expect(out).not.toContain('// gone')
  })

  it('matches the tag with no space before the backtick, which is how oxc leaves it', () => {
    expect(stripWgslLiterals('const P = /* wgsl */`a // b\n`').hits).toBe(1)
  })

  it('reports no hits when the tag is missing, which is what the plugin throws on', () => {
    expect(stripWgslLiterals('const P = `a // b\n`').hits).toBe(0)
  })

  // The prelude is the one module the plugin transforms, and the tag is what it
  // finds it by. Losing the tag is a silent 21 kB, so the file asserts it here.
  it('finds the prelude tagged, and strips comments out of it', () => {
    const code = readFileSync('src/core/gpu/prelude.ts', 'utf8')
    const { code: out, hits } = stripWgslLiterals(code)
    expect(hits).toBe(1)
    expect(out.length).toBeLessThan(code.length - 20_000)
    expect(out).toContain('const SPL = ${SAMPLES_PER_LINE}u;')
  })
})
