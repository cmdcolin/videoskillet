// CROSS_REPO_SYNC_FILE(changelog-test)
import { expect, test } from 'vitest'

import { longDate, parseChangelog, postsByDay, versionSpan } from './changelog'

import { readFileSync } from 'node:fs'

const SAMPLE = `# Changelog

## [Unreleased]

### Features
- [\`aaaaaaa\`](https://example.com/a) not out yet

## [1.1.0](https://example.com/compare/v1.0.1...v1.1.0) - 2026-10-11

### Features
- *(ui)* [\`bbbbbbb\`](https://example.com/b) a new page

### Tests
- [\`ccccccc\`](https://example.com/c) a test nobody reads

## [1.0.1](https://example.com/compare/v1.0.0...v1.0.1) - 2026-10-11

### Fixes
- *(dsp)* [\`ddddddd\`](https://example.com/d) [**breaking**] a quieter click

## [1.0.0](https://example.com/releases/tag/v1.0.0) - 2026-10-01

### Chores
- [\`eeeeeee\`](https://example.com/e) bump a dependency
`

test('reads each release with its groups and skips Unreleased', () => {
  const releases = parseChangelog(SAMPLE)
  expect(releases.map(r => r.version)).toEqual(['1.1.0', '1.0.1', '1.0.0'])
  expect(releases.map(r => Object.fromEntries(r.groups))).toMatchObject([
    {
      Features: [
        {
          scope: 'ui',
          sha: 'bbbbbbb',
          url: 'https://example.com/b',
          text: 'a new page',
        },
      ],
    },
    { Fixes: [{ scope: 'dsp', text: 'a quieter click' }] },
    { Chores: [{ text: 'bump a dependency' }] },
  ])
})

test('one post per day, holding only the groups a reader cares about', () => {
  expect(postsByDay(parseChangelog(SAMPLE))).toMatchObject([
    {
      date: '2026-10-11',
      versions: ['1.1.0', '1.0.1'],
      groups: [
        ['Features', [{ text: 'a new page' }]],
        ['Fixes', [{ text: 'a quieter click' }]],
      ],
    },
  ])
})

test('names a day by its version span and its date', () => {
  expect(versionSpan(['1.1.0', '1.0.1'])).toBe('v1.0.1–v1.1.0')
  expect(versionSpan(['1.0.0'])).toBe('v1.0.0')
  expect(longDate('2026-10-01')).toBe('October 1, 2026')
})

test('every release in the real changelog parses', () => {
  const markdown = readFileSync('CHANGELOG.md', 'utf8')
  const releases = parseChangelog(markdown)
  expect(releases).toHaveLength((markdown.match(/^## \[\d/gm) ?? []).length)
  const changes = (markdown.match(/^- .*\[`\w+`\]/gm) ?? []).length
  const parsed = releases.flatMap(r => [...r.groups.values()].flat()).length
  expect(parsed).toBe(changes)
})
