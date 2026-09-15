// CROSS_REPO_SYNC_FILE(sync-checker)
//
// Checks that the regions this repo shares with its sibling still match.
// docs/CROSS_REPO_SYNC.md describes the markers, the normalisation and the
// workflow; cross-repo-sync.json names the sibling and the product terms.
//
// Run: node scripts/sync-check.mjs [--list] [--strict] [--quiet]
//
// The sibling is found next to this repo's primary checkout, so a worktree
// finds it too. CROSS_REPO_SYNC_SIBLING=/path points it somewhere else, such as
// a worktree of the sibling. A missing sibling is a warning, and an error with
// --strict.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

const MARK = /CROSS_REPO_SYNC(_FILE|_END)?\(([a-z0-9-]+)\)/
const TEXT =
  /\.(astro|css|html|js|json|jsx|md|mjs|ts|tsx|yml|yaml|sh|toml)$|(^|\/)pre-(commit|push)$/

const args = new Set(process.argv.slice(2))

const git = (root, ...rest) =>
  execFileSync('git', ['-C', root, ...rest], { encoding: 'utf8' }).trim()

function loadRepo(root) {
  const config = JSON.parse(
    readFileSync(join(root, 'cross-repo-sync.json'), 'utf8'),
  )
  const files = git(
    root,
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
  )
    .split('\n')
    .filter(file => TEXT.test(file) && existsSync(join(root, file)))
  const regions = new Map()
  const problems = []
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8')
    if (!text.includes('CROSS_REPO_SYNC')) continue
    const lines = text.split('\n')
    const open = new Map()
    const add = (id, body) => {
      if (regions.has(id))
        problems.push(
          `${file}: ${id} is also marked in ${regions.get(id).file}`,
        )
      else regions.set(id, { file, body })
    }
    lines.forEach((line, i) => {
      const found = MARK.exec(line)
      if (found === null) return
      const [, kind, id] = found
      if (kind === '_FILE') add(id, lines.filter((_, j) => j !== i).join('\n'))
      else if (kind === '_END') {
        if (!open.has(id))
          problems.push(`${file}:${i + 1}: ${id} ends without a start`)
        else {
          add(id, lines.slice(open.get(id) + 1, i).join('\n'))
          open.delete(id)
        }
      } else open.set(id, i)
    })
    for (const [id, at] of open)
      problems.push(`${file}:${at + 1}: ${id} has no CROSS_REPO_SYNC_END`)
  }
  return { root, config, regions, problems }
}

// Comment lines go, because each repo explains shared code in its own terms.
// Whitespace goes, because the two repos run different formatters. Each repo's
// product terms become placeholders, so "looks" and "voices" compare equal.
function normalise(body, terms) {
  const kept = []
  let inBlock = null
  for (const raw of body.split('\n')) {
    let line = raw.trim()
    if (inBlock !== null) {
      const end = line.indexOf(inBlock)
      if (end === -1) continue
      line = line.slice(end + inBlock.length).trim()
      inBlock = null
    }
    if (
      line.startsWith('//') ||
      (line.startsWith('{/*') && line.endsWith('*/}'))
    )
      continue
    for (const [start, end] of [
      ['/*', '*/'],
      ['<!--', '-->'],
    ]) {
      if (!line.startsWith(start)) continue
      const close = line.indexOf(end, start.length)
      if (close === -1) {
        inBlock = end
        line = ''
      } else line = line.slice(close + end.length).trim()
    }
    if (line === '') continue
    kept.push(line)
  }
  const byLength = Object.entries(terms).sort(
    (a, b) => b[0].length - a[0].length,
  )
  return kept.map(line => {
    for (const [from, to] of byLength) line = line.split(from).join(`«${to}»`)
    return line
      .replace(/<(\w+)([^<>]*?)\s*><\/\1>/g, '<$1$2/>')
      .replace(/,\s*([)\]}])/g, '$1')
      .replace(/\s+/g, ' ')
  })
}

const squash = lines =>
  lines
    .join('')
    .replace(/\s+/g, '')
    .replace(/,([)\]}>])/g, '$1')

function diff(a, b) {
  const n = a.length
  const m = b.length
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      i++
      j++
    } else if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1]))
      out.push(`    - ${a[i++]}`)
    else out.push(`    + ${b[j++]}`)
  }
  return out
}

const here = loadRepo(git(process.cwd(), 'rev-parse', '--show-toplevel'))
const primary = dirname(
  resolve(here.root, git(here.root, 'rev-parse', '--git-common-dir')),
)
const siblingRoot =
  process.env.CROSS_REPO_SYNC_SIBLING ??
  join(dirname(primary), here.config.sibling)

if (!existsSync(join(siblingRoot, 'cross-repo-sync.json'))) {
  if (!args.has('--quiet'))
    console.warn(`sync-check: no sibling at ${siblingRoot}`)
  process.exit(args.has('--strict') ? 1 : 0)
}
const there = loadRepo(siblingRoot)
const name = here.config.name
const siblingName = there.config.name

let bad = 0
const fail = message => {
  console.log(message)
  bad++
}
for (const problem of here.problems) fail(`${name}: ${problem}`)
for (const problem of there.problems) fail(`${siblingName}: ${problem}`)

const ids = [
  ...new Set([...here.regions.keys(), ...there.regions.keys()]),
].sort()
for (const id of ids) {
  const mine = here.regions.get(id)
  const theirs = there.regions.get(id)
  if (args.has('--list')) {
    console.log(
      `${id}\n  ${name}: ${mine?.file ?? '-'}\n  ${siblingName}: ${theirs?.file ?? '-'}`,
    )
    continue
  }
  if (mine === undefined || theirs === undefined) {
    fail(
      `${id}: only in ${mine === undefined ? siblingName : name} (${(mine ?? theirs).file})`,
    )
    continue
  }
  const termsFor = (region, repo) =>
    region.file.endsWith('.md') ? {} : repo.config.terms
  const a = normalise(mine.body, termsFor(mine, here))
  const b = normalise(theirs.body, termsFor(theirs, there))
  if (squash(a) === squash(b)) continue
  fail(`${id}: ${name} ${mine.file} differs from ${siblingName} ${theirs.file}`)
  const lines = diff(a, b)
  console.log(lines.slice(0, 40).join('\n'))
  if (lines.length > 40) console.log(`    … ${lines.length - 40} more`)
}

if (!args.has('--list') && !(args.has('--quiet') && bad === 0))
  console.log(
    bad === 0
      ? `sync-check: ${ids.length} regions match ${siblingName}`
      : `sync-check: ${bad} problem(s) against ${siblingName}`,
  )
process.exit(bad === 0 ? 0 : 1)
