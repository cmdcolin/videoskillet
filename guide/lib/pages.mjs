import { readFileSync, readdirSync } from 'node:fs'

// The reader's tour, in the order someone new to the thing wants it. This is
// the header nav across the top of every page in the group.
const GUIDE = [
  {
    file: 'docs/GETTING-STARTED.md',
    out: 'index.html',
    nav: 'Getting started',
  },
  { file: 'docs/USER-GUIDE.md', out: 'guide.html', nav: 'User guide' },
  { file: 'docs/FEATURES.md', out: 'features.html', nav: 'Features' },
  { file: 'docs/EFFECTS.md', out: 'effects.html', nav: 'Effects' },
  { file: 'docs/MIDI.md', out: 'midi.html', nav: 'MIDI' },
  { file: 'docs/COMPARISON.md', out: 'comparison.html', nav: 'Comparison' },
  { file: 'docs/FAQ.md', out: 'faq.html', nav: 'FAQ' },
]

const NOTES = [
  {
    file: 'docs/ARCHITECTURE.md',
    out: 'architecture.html',
    nav: 'Architecture',
  },
  {
    file: 'docs/OPTIMIZATIONS.md',
    out: 'optimizations.html',
    nav: 'Optimizations',
  },
  { file: 'docs/DEVELOPMENT.md', out: 'development.html', nav: 'Development' },
  { file: 'docs/EDITOR.md', out: 'editor.html', nav: 'Editor' },
  { file: 'docs/IDEAS.md', out: 'ideas.html', nav: 'Ideas' },
  { file: 'docs/CURATION.md', out: 'curation.html', nav: 'Curation' },
  { file: 'docs/VOTING.md', out: 'voting.html', nav: 'Voting' },
  { file: 'docs/adr/README.md', out: 'decisions.html', nav: 'Decisions' },
  { file: 'docs/handoffs/README.md', out: 'handoffs.html', nav: 'Handoffs' },
]

// GitHub's anchor ids, so the in-page links the markdown already carries work
// here too.
export const slug = text =>
  text
    .toLowerCase()
    .replaceAll(/[^\da-z -]/g, '')
    .trim()
    .replaceAll(' ', '-')

const heading = file => {
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find(l => l.startsWith('# '))
  return line === undefined ? file : line.slice(2)
}

// Flat output names (`adr-0004-….html`) keep every page in one directory, which
// is what lets the figures and every cross-link stay relative.
const folder = (dir, prefix) =>
  readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(f => ({
      file: `${dir}/${f}`,
      out: `${prefix}-${f.replace(/\.md$/, '.html')}`,
      nav: heading(`${dir}/${f}`),
    }))

const ADRS = folder('docs/adr', 'adr')
const HANDOFFS = folder('docs/handoffs', 'handoff')

// The records borrow the notes nav with Decisions marked, since their own index
// is that page and a nav of eight numbered titles is a wall.
const GROUPS = [
  {
    label: 'guide',
    pages: GUIDE,
    nav: GUIDE,
    mark: spec => spec.out,
    foot: { href: 'architecture.html', text: 'How it is built' },
  },
  {
    label: 'notes',
    pages: NOTES,
    nav: NOTES,
    mark: spec => spec.out,
    foot: { href: 'index.html', text: 'Guide' },
  },
  {
    label: 'decisions',
    pages: ADRS,
    nav: NOTES,
    mark: () => 'decisions.html',
    foot: { href: 'decisions.html', text: 'All decisions' },
  },
  {
    label: 'handoff',
    pages: HANDOFFS,
    nav: NOTES,
    mark: () => 'handoffs.html',
    foot: { href: 'handoffs.html', text: 'All handoffs' },
  },
]

export const ALL = GROUPS.flatMap(group =>
  group.pages.map(spec => ({
    ...spec,
    group,
    id: spec.file.replace(/^docs\//, '').replace(/\.md$/, ''),
    slug:
      spec.out === 'index.html' ? undefined : spec.out.replace(/\.html$/, ''),
  })),
)

// Where a markdown link goes on the site, keyed by the source path it resolves
// to. Anything else relative is a file with no page here, so it goes to the repo.
export const LINKS = new Map([
  ...ALL.map(spec => [spec.file, spec.out]),
  ['docs/adr', 'decisions.html'],
  ['docs/handoffs', 'handoffs.html'],
])
