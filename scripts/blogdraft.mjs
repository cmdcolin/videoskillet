// Drafts a blog post from the feature commits since site/posts last changed.
// Claude Code writes it into the posts directory as `draft: true`, and a person
// edits it, shoots its stills and drops the flag.
//
// Run: node scripts/blogdraft.mjs [--since=YYYY-MM-DD] [--prompt]
//      (via pnpm blog:draft)
//
// --prompt prints the brief and stops, for pasting into a session by hand.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'

const NAME = 'videoskillet'
const POSTS = 'site/posts'
const IMAGES = 'public/blog'
const LOOKS =
  'Link a preset as `/app/#preset=<name>&src=clip-haunted-house`, where `<name>` is the `name` field in src/ui/presets.ts. The haunted-house cartoon is the source that shows motion effects best.'

// CROSS_REPO_SYNC(blog-draft)
const flag = name =>
  process.argv.find(arg => arg.startsWith(`--${name}`))?.split('=')[1] ?? ''

const posts = readdirSync(POSTS)
  .filter(file => file.endsWith('.md'))
  .map(file => ({
    file,
    text: readFileSync(`${POSTS}/${file}`, 'utf8'),
  }))
const dateOf = text => /^date: '?(\d{4}-\d{2}-\d{2})/m.exec(text)?.[1] ?? ''
const newest = posts.toSorted((a, b) =>
  dateOf(b.text).localeCompare(dateOf(a.text)),
)[0]
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const since =
  flag('since') || git('log', '-1', '--format=%cI', '--', POSTS) || ''

const log = git(
  'log',
  '--no-merges',
  '--format=%h%x1f%ad%x1f%s%x1f%b%x1e',
  '--date=short',
  ...(since ? [`--since=${since}`] : ['-50']),
)
const commits = log
  .split('\x1e')
  .map(record => record.trim().split('\x1f'))
  .filter(([, , subject]) => /^feat(\(|:|!)/.test(subject ?? ''))
  .map(
    ([sha, date, subject, body]) =>
      `### ${subject} (${sha}, ${date})\n\n${(body ?? '')
        .replace(/^Co-Authored-By:.*$/gim, '')
        .trim()}`,
  )

if (commits.length === 0) {
  console.error(`no feat commits after ${since || 'the start'}`)
  process.exit(1)
}

const today = new Date().toLocaleDateString('sv-SE')
const writing = existsSync('docs/WRITING.md')
  ? readFileSync('docs/WRITING.md', 'utf8')
  : ''

const brief = `Write a blog post for the ${NAME} website about the changes in the commits below. The readers use the app; they do not read its source.

- Pick the one to three changes a user would notice most. Leave out fixes, refactors and interface tweaks unless they change what a user can do.
- For each change, say what the user sees, then explain the mechanism that causes it in a short paragraph. The commit bodies explain the mechanisms; read the source if one is unclear.
- ${LOOKS}
- Put one image under each section heading, as \`![alt text describing the still](/${IMAGES.replace(/^public\//, '')}/<short-name>.webp)\`. The images do not exist yet: a person shoots them after reading the draft, so the alt text says what each still should show.
- Follow the writing guide below. Plain declarative sentences, no marketing adjectives, no closing summary. Leave out version numbers, since the commits do not say which release each one shipped in.
- Reply with the markdown file and nothing else. It opens with this frontmatter:

---
title: <a plain title naming the changes>
date: ${today}
summary: <one sentence for the blog index>
image: <the first image's path>
imageAlt: <its alt text>
look: '<the hash part of the first preset link, starting with #>'
draft: true
---

${newest ? `The newest post, for the format and the tone:\n\n${newest.text}\n` : ''}
${writing ? `The writing guide:\n\n${writing}\n` : ''}
The commits, newest first:

${commits.join('\n\n')}
`

if (process.argv.includes('--prompt')) {
  process.stdout.write(brief)
  process.exit(0)
}

const out = `${POSTS}/draft-${today}.md`
if (existsSync(out)) {
  console.error(`${out} exists; rename or delete it first`)
  process.exit(1)
}

console.error(
  `drafting from ${commits.length} feat commit(s) after ${since || 'the start'}…`,
)
const claude = spawnSync(
  'claude',
  ['-p', '--allowedTools', 'Read', 'Grep', 'Glob'],
  { input: brief, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] },
)
if (claude.error || claude.status !== 0) {
  console.error(
    `claude failed (${claude.error?.message ?? `exit ${claude.status}`}); --prompt prints the brief`,
  )
  process.exit(1)
}

const start = claude.stdout.indexOf('---\n')
const draft = claude.stdout
  .slice(Math.max(start, 0))
  .trim()
  .replace(/\n```$/, '')
writeFileSync(out, `${draft}\n`)
console.error(
  `wrote ${out}. Edit it, shoot the stills it names into ${IMAGES}/, rename it to the post's slug and drop \`draft: true\`.`,
)
// CROSS_REPO_SYNC_END(blog-draft)
