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

// A clip gets a frame, a dimmed poster and a play button over it.
//
// The markdown ships a bare `<video controls poster>`, which is what GitHub
// renders and all it will render — its sanitizer drops the button and the
// wrapper, and the reader gets the browser's own control bar over the poster.
// So the overlay is added here rather than written into the page: this is the
// half only the site can show, and adding it in the markdown would put dead
// markup in the file GitHub serves.
//
// The reason a clip needs one at all is that a poster and a still are the same
// thing to a reader scrolling past. Every figure in these docs is a screenshot,
// so a frame that is merely sitting there reads as one more of them, and the
// only tell is a control bar the browser draws in its own good time.
const wrapVideos = tree => {
  // A `<video>` written on its own line arrives inside the paragraph markdown
  // put around it, and a `<div>` inside a `<p>` is not something a browser
  // keeps: it closes the paragraph early and leaves an empty one behind with
  // the margin still on it. So the frame takes the paragraph's place whenever
  // the paragraph holds nothing else.
  visit(tree, 'element', (node, i, parent) => {
    if (node.tagName !== 'p' || parent === undefined) return
    const kids = node.children.filter(
      c => c.type !== 'text' || c.value.trim() !== '',
    )
    const only = kids.length === 1 ? kids[0] : undefined
    if (only?.type === 'element' && only.tagName === 'video') {
      parent.children[i] = only
    }
  })
  visit(tree, 'element', (node, i, parent) => {
    if (node.tagName !== 'video' || parent === undefined) return
    if (
      parent.type === 'element' &&
      parent.properties?.className?.includes('videoframe')
    )
      return
    parent.children[i] = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['videoframe'] },
      children: [
        node,
        {
          type: 'element',
          tagName: 'button',
          properties: {
            type: 'button',
            className: ['videoplay'],
            // What a screen reader is handed, since everything else about this
            // control is a triangle drawn in CSS.
            ariaLabel: 'Play',
          },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['videoplayicon'] },
              children: [],
            },
          ],
        },
      ],
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
  wrapVideos(tree)
  linkFigures(tree)
  const data = file.data.astro.frontmatter
  data.outline = outline
  data.summary = summarise(tree)
}
