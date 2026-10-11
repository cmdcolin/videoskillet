// CROSS_REPO_SYNC_FILE(changelog)
// Reads the CHANGELOG.md that git-cliff writes (cliff.toml) and regroups it as
// one blog post per day, since a busy day ships several releases.

export interface Change {
  scope?: string
  sha: string
  url: string
  text: string
}

export interface Release {
  version: string
  date: string
  groups: Map<string, Change[]>
}

export interface Post {
  date: string
  versions: string[]
  groups: [string, Change[]][]
}

export const SHOWN_GROUPS = [
  'Features',
  'Fixes',
  'Performance',
  'Other Changes',
] as const

const RELEASE = /^## \[([^\]]+)\]\([^)]*\) - (\d{4}-\d{2}-\d{2})$/
const GROUP = /^### (.+)$/
const CHANGE =
  /^- (?:\*\(([^)]+)\)\* )?\[`(\w+)`\]\(([^)]+)\) (?:\[\*\*breaking\*\*\] )?(.+)$/

export function parseChangelog(markdown: string) {
  const releases: Release[] = []
  let release: Release | undefined
  let group: Change[] | undefined
  for (const line of markdown.split('\n')) {
    const [, version, date] = RELEASE.exec(line) ?? []
    if (version && date) {
      release = { version, date, groups: new Map() }
      releases.push(release)
      group = undefined
      continue
    }
    if (line.startsWith('## ')) {
      release = undefined
      continue
    }
    const [, title] = GROUP.exec(line) ?? []
    if (title && release) {
      group = release.groups.get(title) ?? []
      release.groups.set(title, group)
      continue
    }
    const [, scope, sha, url, text] = CHANGE.exec(line) ?? []
    if (sha && url && text && group) group.push({ scope, sha, url, text })
  }
  return releases
}

export function postsByDay(
  releases: Release[],
  shown: readonly string[] = SHOWN_GROUPS,
) {
  const posts = new Map<string, Post>()
  for (const release of releases) {
    const post = posts.get(release.date) ?? {
      date: release.date,
      versions: [],
      groups: shown.map(name => [name, []] as [string, Change[]]),
    }
    posts.set(release.date, post)
    post.versions.push(release.version)
    for (const [name, changes] of post.groups)
      changes.push(...(release.groups.get(name) ?? []))
  }
  return [...posts.values()]
    .map(post => ({
      ...post,
      groups: post.groups.filter(([, changes]) => changes.length > 0),
    }))
    .filter(post => post.groups.length > 0)
}

export function versionSpan(versions: string[]) {
  const newest = versions[0]
  const oldest = versions.at(-1)
  return newest === oldest ? `v${newest}` : `v${oldest}–v${newest}`
}

export function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
