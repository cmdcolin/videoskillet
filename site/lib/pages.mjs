import { readFileSync, readdirSync } from 'node:fs'

// The reader's tour, in the order someone new to the thing wants it. This is
// the header nav across the top of every page in the group.
const GUIDE = [
  { file: 'docs/GETTING-STARTED.md', slug: '', nav: 'Getting started' },
  { file: 'docs/USER-GUIDE.md', slug: 'guide', nav: 'User guide' },
  { file: 'docs/FEATURES.md', slug: 'features', nav: 'Features' },
  { file: 'docs/EFFECTS.md', slug: 'effects', nav: 'Effects' },
  { file: 'docs/MIDI.md', slug: 'midi', nav: 'MIDI' },
  { file: 'docs/COMPARISON.md', slug: 'comparison', nav: 'Comparison' },
  { file: 'docs/FAQ.md', slug: 'faq', nav: 'FAQ' },
]

const NOTES = [
  { file: 'docs/ARCHITECTURE.md', slug: 'architecture', nav: 'Architecture' },
  {
    file: 'docs/OPTIMIZATIONS.md',
    slug: 'optimizations',
    nav: 'Optimizations',
  },
  { file: 'docs/DEVELOPMENT.md', slug: 'development', nav: 'Development' },
  { file: 'docs/AI-USAGE.md', slug: 'ai', nav: 'AI' },
  { file: 'docs/EDITOR.md', slug: 'editor', nav: 'Editor' },
  { file: 'docs/IDEAS.md', slug: 'ideas', nav: 'Ideas' },
  { file: 'docs/CURATION.md', slug: 'curation', nav: 'Curation' },
  { file: 'docs/adr/README.md', slug: 'decisions', nav: 'Decisions' },
  { file: 'docs/handoffs/README.md', slug: 'handoffs', nav: 'Handoffs' },
]

// The address a page is read at. Every link on the site is written in this
// form — site-absolute, ending in a slash — so the depth a page sits at is
// nobody's business but this function's, and the URL a reader copies out of the
// bar carries no filename.
export const href = slug => (slug === '' ? '/guide/' : `/guide/${slug}/`)

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

// Flat slugs (`adr-0004-…`) keep every page one directory deep under /guide/,
// which is what lets the figures sit beside them at /guide/img/.
const folder = (dir, prefix) =>
  readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(f => ({
      file: `${dir}/${f}`,
      slug: `${prefix}-${f.replace(/\.md$/, '')}`,
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
    mark: spec => spec.slug,
  },
  {
    label: 'notes',
    pages: NOTES,
    nav: NOTES,
    mark: spec => spec.slug,
  },
  {
    label: 'decisions',
    pages: ADRS,
    nav: NOTES,
    mark: () => 'decisions',
  },
  {
    label: 'handoff',
    pages: HANDOFFS,
    nav: NOTES,
    mark: () => 'handoffs',
  },
]

export const ALL = GROUPS.flatMap(group =>
  group.pages.map(spec => ({
    ...spec,
    group,
    id: spec.file.replace(/^docs\//, '').replace(/\.md$/, ''),
  })),
)

// Where a markdown link goes on the site, keyed by the source path it resolves
// to. Anything else relative is a file with no page here, so it goes to the repo.
export const LINKS = new Map([
  ...ALL.map(spec => [spec.file, href(spec.slug)]),
  ['docs/adr', href('decisions')],
  ['docs/handoffs', href('handoffs')],
])
