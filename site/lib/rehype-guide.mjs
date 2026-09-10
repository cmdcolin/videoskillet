import { visit } from 'unist-util-visit'

import { slug } from './pages.mjs'

import { readFileSync } from 'node:fs'

const IMG = '/guide/img/'

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

// The diagrams and the clips are raw HTML in the markdown, and their `img/…`
// paths are relative to `docs/`, which is where GitHub reads them. Here every
// page is a directory of its own, so nothing relative would find the figures:
// they are copied to one place and addressed from it.
const FIGURE_ATTRS = ['src', 'srcSet', 'srcset', 'poster']

const absoluteFigures = tree => {
  visit(tree, 'element', node => {
    for (const attr of FIGURE_ATTRS) {
      const value = node.properties[attr]
      if (typeof value === 'string' && value.startsWith('img/')) {
        node.properties[attr] = IMG + value.slice('img/'.length)
      }
    }
  })
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

// An install page has routes through it rather than sections of it: a reader
// takes the binary or takes a clone, and the route they did not take is prose
// they read past. The markdown marks a run of `###` sections as a set of
// routes, and the site puts them behind one row of tabs.
//
// The markdown stays what GitHub renders — plain subsections between two
// comments, which GitHub drops — so the page reads the same in both places and
// nothing dead goes into the file. This is the split the clip frames use.
//
//     <!-- tabs: Install options -->
//     ### The binary
//     …
//     ### From a clone
//     …
//     <!-- /tabs -->
//
// Each heading becomes a tab and its section the panel behind it. The panel
// carries the heading's own id, so a link to `#from-a-clone` still lands on it
// and site/scripts/tabs.js opens that tab on arrival.
const OPEN = /^\s*tabs(?::\s*(.+?))?\s*$/
const CLOSE = /^\s*\/tabs\s*$/

const isOpen = node => node.type === 'comment' && OPEN.test(node.value)
const isClose = node => node.type === 'comment' && CLOSE.test(node.value)

// A marker with a typo in it is the failure that has nothing to show for
// itself: a comment renders as nothing on GitHub and nothing here, so the
// sections stay flat and the page looks like someone decided against tabs.
// Anything that was reaching for a marker and missed stops the build instead.
const NEAR = /^\s*\/?\s*tabs?\b/i

const checkMarkers = tree => {
  visit(tree, 'comment', node => {
    if (NEAR.test(node.value) && !isOpen(node) && !isClose(node)) {
      throw new Error(`not a tabs marker: <!--${node.value}-->`)
    }
  })
}

const tabButton = (route, i) => ({
  type: 'element',
  tagName: 'button',
  properties: {
    type: 'button',
    className: ['tab'],
    role: 'tab',
    id: `tab-${route.id}`,
    ariaControls: route.id,
    ariaSelected: i === 0 ? 'true' : 'false',
    // Roving: the row is one stop on the tab key, and the arrow keys move
    // within it. tabs.js keeps this in step with the selection.
    tabIndex: i === 0 ? 0 : -1,
  },
  children: [{ type: 'text', value: route.label }],
})

const tabPanel = (route, i) => ({
  type: 'element',
  tagName: 'section',
  properties: {
    className: ['tabpanel'],
    role: 'tabpanel',
    id: route.id,
    ariaLabelledBy: `tab-${route.id}`,
    tabIndex: 0,
    hidden: i > 0,
  },
  children: route.body,
})

// Scripting off leaves a row of buttons that do nothing over the one route the
// server happened to open. Every panel is in the markup either way, so the
// fallback shows them the way the markdown does: each section under its own
// heading, with no tab row.
const FALLBACK = {
  type: 'element',
  tagName: 'noscript',
  properties: {},
  children: [
    {
      type: 'element',
      tagName: 'style',
      properties: {},
      children: [
        {
          type: 'text',
          value:
            '.tabbar{display:none}.tabpanel[hidden]{display:block}' +
            '.tabpanel{padding-top:0}.tabhead{display:revert}',
        },
      ],
    },
  ],
}

const tabs = (routes, label) => ({
  type: 'element',
  tagName: 'div',
  properties: { className: ['tabs'] },
  children: [
    FALLBACK,
    {
      type: 'element',
      tagName: 'div',
      properties: { className: ['tabbar'], role: 'tablist', ariaLabel: label },
      children: routes.map(tabButton),
    },
    ...routes.map(tabPanel),
  ],
})

// The heading stays in the panel for the fallback to show, hidden while the tab
// row is doing the labelling. `tabhead` also keeps it out of the page outline: a
// section nav that scrolls to something invisible is a broken link.
// The panel takes the section's slug, so the heading needs an id of its own:
// Astro gives every heading one, and two elements answering to `#the-binary`
// is a link that lands on whichever the browser saw first.
const route = heading => {
  const label = text(heading)
  const id = slug(label)
  heading.properties.className = ['tabhead']
  heading.properties.id = `${id}-head`
  return { id, label, body: [heading] }
}

const split = nodes => {
  const routes = []
  for (const node of nodes) {
    if (node.type === 'element' && node.tagName === 'h3') {
      routes.push(route(node))
    } else if (routes.length > 0) {
      routes.at(-1).body.push(node)
    }
  }
  return routes
}

const groupTabs = tree => {
  checkMarkers(tree)
  visit(tree, node => {
    if (node.children === undefined) return
    for (;;) {
      const open = node.children.findIndex(isOpen)
      if (open === -1) return
      const close = node.children.findIndex((c, i) => i > open && isClose(c))
      if (close === -1) throw new Error('a <!-- tabs --> block is never closed')
      const routes = split(node.children.slice(open + 1, close))
      if (routes.length === 0) {
        throw new Error('a <!-- tabs --> block holds no ### sections')
      }
      const label = OPEN.exec(node.children[open].value)[1] ?? 'Options'
      node.children.splice(open, close - open + 1, tabs(routes, label))
    }
  })
}

const headings = tree => {
  const outline = []
  visit(tree, 'element', node => {
    const level = /^h([1-6])$/.exec(node.tagName)
    if (level === null) return
    const depth = Number(level[1])
    if (node.properties.className?.includes('tabhead')) return
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
    if (typeof src !== 'string' || !src.startsWith(IMG)) return
    const live = shots.get(src.slice(IMG.length))
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
  absoluteFigures(tree)
  collapsePictures(tree)
  groupTabs(tree)
  const outline = headings(tree)
  wrapTables(tree)
  wrapVideos(tree)
  linkFigures(tree)
  const data = file.data.astro.frontmatter
  data.outline = outline
  data.summary = summarise(tree)
}
