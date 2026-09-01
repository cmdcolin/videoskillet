// Bump the version, tag it, and push — the version is stamped into the build
// (vite.config.ts `define`) and shown in the sidebar header. `pnpm version`
// also runs the package.json "version" lifecycle script, which regenerates
// CHANGELOG.md via git-cliff (see cliff.toml) and folds it into the same
// release commit.
// Usage: node scripts/push.mjs <patch|minor|major>   (via pnpm {pat,min,maj})

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const bump = process.argv[2]
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`usage: node scripts/push.mjs <patch|minor|major>`)
  process.exit(1)
}

function run(cmd) {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit' })
}

const read = cmd => execSync(cmd).toString().trim()

function refuse(message) {
  console.error(message)
  process.exit(1)
}

if (read('git status --porcelain')) {
  refuse(
    'working tree is dirty — commit or discard changes before pushing a release',
  )
}

// Everything below asks the remote rather than the local refs, and runs before
// the slow checks — a release cut from a stale checkout should fail in a second
// rather than after a full test run.
// --force so a local tag that has drifted from origin's (e.g. an old release
// re-tagged upstream) gets synced rather than rejected as a clobber.
run('git fetch --tags --force --quiet origin main')

// `pnpm version` counts up from whatever package.json says *here*. A checkout
// behind main therefore bumps from an old number and lands on a version already
// tagged, or below one — which is how a release stops being the newest thing
// released.
const behind = read('git rev-list --count HEAD..origin/main')
if (behind !== '0') {
  refuse(
    `HEAD is ${behind} commit(s) behind origin/main — rebase before releasing`,
  )
}

const parse = v => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v)
  return m === null ? null : m.slice(1, 4).map(Number)
}
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const current = parse(version)
if (current === null) {
  refuse(
    `package.json version ${version} is not a plain x.y.z — bump it by hand`,
  )
}

const [major, minor, patch] = current
const next =
  bump === 'major'
    ? [major + 1, 0, 0]
    : bump === 'minor'
      ? [major, minor + 1, 0]
      : [major, minor, patch + 1]

const highest = read("git ls-remote --tags --refs origin 'v*'")
  .split('\n')
  .map(line => parse(line.split('refs/tags/v')[1] ?? ''))
  .filter(v => v !== null)
  .sort(compare)
  .at(-1)

if (highest !== undefined && compare(next, highest) <= 0) {
  refuse(
    `v${next.join('.')} would not be above v${highest.join('.')}, the highest tag on ` +
      `origin — this checkout is at v${version}. Rebase, or bump past it by hand.`,
  )
}

// Catch what CI would catch, before it's a remote failure blocking the release.
for (const check of [
  'pnpm lint',
  'pnpm format:check',
  'pnpm test',
  'pnpm build',
]) {
  run(check)
}

// docshots:check is here rather than in deploy.yml because retaking a shot needs
// Firefox Nightly and a GPU, which the runner has not got. It fires once per
// version bump on the masthead alone, whether or not a shot's own content
// moved, so it warns rather than blocking the release — retake at leisure with
// the command it prints.
try {
  run('pnpm docshots:check')
} catch {
  console.warn(
    'docshots are behind — retake when convenient, not blocking this release',
  )
}

// `pnpm version` bumps package.json, commits it, and creates a `v<x.y.z>` tag.
run(`pnpm version ${bump} -m "Release v%s"`)
run('git push --follow-tags')
