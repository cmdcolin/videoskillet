import { visit } from 'unist-util-visit'

import { slug } from './pages.mjs'

import { readFileSync } from 'node:fs'

// The live URL for each captured figure, keyed by the image file it produced
// (scripts/docshots.mjs writes both). A figure whose image came from a spec gets
// the session that produced it as a link, so the reader can open the exact state
// in the screenshot and move the sliders.
const shots = new Map(
  JSON.parse(readFileSync('docs/img/shots.json', 'utf8')).map(s => [
    s.file,
    s.live,
  ]),
)

const text = node =>
  node.type === 'text'
    ? node.value
    : node.children === undefined
      ? ''
      : node.children.map(text).join('')

// Every page's first paragraph is already a summary of it, so it is also the
// meta description and the text a shared link unfurls with. Cut on a sentence
// where there is one, since a description that stops mid-clause reads as broken.
const summarise = tree => {
  let first
  visit(tree, 'element', node => {
    if (first === undefined && node.tagName === 'p') first = node
  })
  if (first === undefined) return ''
  const body = text(first).replaceAll(/\s+/g, ' ').trim()
  if (body.length <= 200) return body
  const head = body.slice(0, 200)
  const stop = head.lastIndexOf('. ')
  return stop > 80
    ? head.slice(0, stop + 1)
    : `${head.slice(0, head.lastIndexOf(' ')).trimEnd()}…`
}

// The markdown ships each Graphviz diagram as a <picture> so GitHub can serve a
// light or dark SVG per the reader's OS. This site has one theme and it is dark,
// so honouring prefers-color-scheme here would hand a light-mode visitor pale
// pastel diagrams on a near-black page. Collapse to the dark source instead.
const collapsePictures = tree => {
  visit(tree, 'element', (node, i, parent) => {
    if (node.tagName !== 'picture' || parent === undefined) return
    const kids = node.children.filter(c => c.type === 'element')
    const dark = kids.find(
      c =>
        c.tagName === 'source' &&
        c.properties.media === '(prefers-color-scheme: dark)',
    )
    const img = kids.find(c => c.tagName === 'img')
    if (dark === undefined || img === undefined) return
    img.properties.src = dark.properties.srcSet ?? dark.properties.srcset
    parent.children[i] = img
  })
}

const headings = tree => {
  const outline = []
  visit(tree, 'element', node => {
    const level = /^h([1-6])$/.exec(node.tagName)
    if (level === null) return
    const depth = Number(level[1])
    const id = slug(text(node))
    node.properties.id = id
    if (depth === 2 || depth === 3) {
      outline.push({ level: depth, id, text: text(node) })
      // The anchors already exist; this is the only way a reader finds out they
      // can be linked to.
      node.children.push({
        type: 'element',
        tagName: 'a',
        properties: {
          className: ['anchor'],
          href: `#${id}`,
          ariaLabel: 'Permalink to this section',
        },
        children: [{ type: 'text', value: '#' }],
      })
    }
  })
  return outline
}

// Wide tables get a scroll container of their own rather than squeezing their
// columns down to two words a line. `scripts/guidecheck.mjs` measures overflow
// against this class name.
const wrapTables = tree => {
  visit(tree, 'element', (node, i, parent) => {
    if (node.tagName !== 'table' || parent === undefined) return
    if (
      parent.type === 'element' &&
      parent.properties?.className?.includes('tablewrap')
    )
      return
    parent.children[i] = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['tablewrap'] },
      children: [node],
    }
  })
}

const linkFigures = tree => {
  visit(tree, 'element', (node, i, parent) => {
    if (node.tagName !== 'img' || parent === undefined) return
    const src = node.properties.src
    if (typeof src !== 'string' || !src.startsWith('img/')) return
    const live = shots.get(src.slice('img/'.length))
    if (live === undefined) return
    parent.children[i] = {
      type: 'element',
      tagName: 'figure',
      properties: {},
      children: [
        node,
        {
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'a',
              properties: { href: live },
              children: [{ type: 'text', value: 'open this in the app ↗' }],
            },
          ],
        },
      ],
    }
  })
}

export const rehypeGuide = () => (tree, file) => {
  collapsePictures(tree)
  const outline = headings(tree)
  wrapTables(tree)
  linkFigures(tree)
  const data = file.data.astro.frontmatter
  data.outline = outline
  data.summary = summarise(tree)
}
