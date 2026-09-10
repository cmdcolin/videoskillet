import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import rehypeRaw from 'rehype-raw'
import { beforeAll, expect, test } from 'vitest'

import { rehypeGuide } from '../lib/rehype-guide.mjs'
import { remarkGuide } from '../lib/remark-guide.mjs'

// The tabs markers are two HTML comments, and every renderer draws a comment as
// nothing at all. A typo in one therefore leaves the subsections flat and puts
// nothing on the page to say that anything was meant to happen there, which is
// the failure these tests are here to catch. The rest of them cover what the
// transform promises the markdown: a tab for each section, the section's own id
// on the panel behind it, and those headings out of the page outline.
//
// The processor is built the way `astro.config.mjs` builds it, because the
// plugin order is part of what these tests cover. `rehypeRaw` has to run first;
// otherwise the markers are still an unparsed string when `rehypeGuide` looks
// for them.
type Head = { level: number; id: string; text: string }

let render: (md: string) => Promise<{ html: string; outline: Head[] }>

beforeAll(async () => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    remarkPlugins: [remarkGuide],
    rehypePlugins: [rehypeRaw, rehypeGuide],
    remarkRehype: { allowDangerousHtml: true },
  })
  render = async (md: string) => {
    const out = await processor.render(md, {
      fileURL: new URL(`file://${process.cwd()}/docs/TEST.md`),
    })
    return {
      html: out.code,
      outline: out.metadata.frontmatter.outline,
    }
  }
})

const PAGE = `## Installing

Both routes need ffmpeg.

<!-- tabs: How to install -->

### The binary

Download it.

### From a clone

Clone it.

<!-- /tabs -->

## Limitations
`

test('a marked run of sections becomes one tab row', async () => {
  const { html } = await render(PAGE)
  expect(html).toContain('role="tablist"')
  expect(html).toContain('aria-label="How to install"')
  expect(html.match(/role="tab"/g)).toHaveLength(2)
  expect(html).toContain('>The binary</button>')
  expect(html).toContain('>From a clone</button>')
})

test('the first route is open and the rest are folded away', async () => {
  const { html } = await render(PAGE)
  expect(html).toMatch(/id="the-binary"[^>]*tabindex="0"(?![^>]*hidden)/)
  expect(html).toMatch(/id="from-a-clone"[^>]*hidden/)
  expect(html).toContain('aria-selected="true"')
  expect(html.match(/aria-selected="false"/g)).toHaveLength(1)
})

// An old link to a section that has become a tab still has to land on it, so
// the panel takes the heading's slug. The heading then needs an id of its own,
// because Astro gives every heading an id, and if two elements answered to
// `#the-binary` a link would land on whichever one the browser saw first.
test('the panel takes the section id, and nothing else claims it', async () => {
  const { html } = await render(PAGE)
  expect(html).toContain(
    '<section class="tabpanel" role="tabpanel" id="the-binary"',
  )
  expect(html.match(/id="the-binary"/g)).toHaveLength(1)
  expect(html).toContain('id="the-binary-head"')
  expect(html).toContain('aria-controls="the-binary"')
})

test('a tabbed section stays out of the page outline', async () => {
  const { outline } = await render(PAGE)
  expect(outline.map(head => head.id)).toEqual(['installing', 'limitations'])
})

// Every panel is in the markup, so a reader with scripting off can see all of
// them, each one under its own heading.
test('the fallback puts every route back', async () => {
  const { html } = await render(PAGE)
  expect(html).toContain('<noscript><style>')
  expect(html).toContain('.tabpanel[hidden]{display:block}')
  expect(html).toContain('.tabhead{display:revert}')
  expect(html.match(/class="tabhead"/g)).toHaveLength(2)
})

test('markdown with no markers in it is left alone', async () => {
  const { html, outline } = await render('## Installing\n\n### The binary\n')
  expect(html).not.toContain('tablist')
  expect(outline.map(head => head.id)).toEqual(['installing', 'the-binary'])
})

test('an unclosed block fails the build', async () => {
  await expect(
    render('<!-- tabs -->\n\n### The binary\n\nDownload it.\n'),
  ).rejects.toThrow(/never closed/)
})

test('a block holding no sections fails the build', async () => {
  await expect(
    render('<!-- tabs -->\n\nDownload it.\n\n<!-- /tabs -->\n'),
  ).rejects.toThrow(/no ### sections/)
})

test('a marker with a typo in it fails rather than vanishing', async () => {
  for (const marker of [
    '<!-- tab -->',
    '<!-- tabs; Install -->',
    '<!-- / tabs. -->',
  ]) {
    await expect(
      render(`${marker}\n\n### The binary\n\nDownload it.\n\n<!-- /tabs -->\n`),
      marker,
    ).rejects.toThrow(/not a tabs marker/)
  }
})
