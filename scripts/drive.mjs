// How a harness pokes this app: what to seed before it boots, how to find a
// control by what a reader would call it, and how to run one declarative
// action against a live page.
//
// It was `docshots.mjs`'s, and it is here because a second harness wanted it —
// `appreel.mjs`, which records the app's own window for the landing page. Both
// have to open the same stages, drag the same sliders and know that a range
// input React owns cannot be written to directly, and neither of them is the
// place to keep that knowledge.
//
// The page-side half (`seedStorage`, `installHelpers`) is injected as *source*,
// so it closes over nothing out here and must go on doing so.

const sleep = ms => new Promise(r => setTimeout(r, ms))

// What the app has stashed in localStorage before a shot loads. Panels remember
// whether they were open, the preset shortlist remembers what you last used, and
// hints remember being dismissed — so without a seed, every shot would show
// whichever state the last one happened to leave behind.
//
// No open stage is seeded here, which is deliberate: that is the app's own
// resting state, the map with nothing unfolded over it. A shot that wants a
// stage open says which one (`video_feedback_open_phase`) in its own spec,
// rather than every shot inheriting whichever one a default happened to pick.
export const SEED = {
  'videoskillet.js_overlay_bar_hidden': '0',
  'videoskillet.js_fps_hidden': '0',
  video_feedback_preset_hint_dismissed: '0',
  video_feedback_presets_expanded: '0',
  video_feedback_recent_presets: '[]',
  video_feedback_sections: JSON.stringify({
    Presets: true,
    Scenes: false,
    'Sound into the picture': false,
  }),
}

// ---------------------------------------------------------------- page side

// Runs before any app script: the app reads these on mount.
export function seedStorage(seed) {
  localStorage.clear()
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v)
}

// Everything that runs inside the page — element resolution, the callout
// overlay, and the DOM pokes an action needs. Injected as source, so it closes
// over nothing out here.
export function installHelpers() {
  const stage = () => document.querySelector('canvas').parentElement
  const ROLES = {
    canvas: () => document.querySelector('canvas'),
    stage,
    panel: () => stage().nextElementSibling,
    // The modal's inner card, not the full-viewport <dialog> backdrop.
    dialog: () => document.querySelector('dialog')?.firstElementChild ?? null,
    // An open Popover (the app menu). CSS modules hash the class, but the
    // local name survives in it.
    menu: () => document.querySelector('div[class*="menu_"]'),
  }

  // A control by its visible text. Exact match first; failing that the tightest
  // control containing it, which is what reaches a menu row whose label sits
  // beside an icon glyph and a keyboard hint.
  const byText = text => {
    const all = [...document.querySelectorAll('button, a, select, option')]
    const exact = all.filter(el => el.textContent.trim() === text)
    const loose = all
      .filter(el => el.textContent.includes(text))
      .sort((a, b) => a.textContent.length - b.textContent.length)
    return exact.at(-1) ?? loose.at(0) ?? null
  }

  // A collapsible Section, by the title in its header. Header text carries the
  // caret (and a • when something inside is off stock), so match the head.
  const section = title => {
    const btn = [...document.querySelectorAll('h3 button')].find(b =>
      b.textContent
        .replace(/^[▸▾]/, '')
        .trim()
        .startsWith(title),
    )
    return btn === undefined ? null : btn.closest('h3').parentElement
  }

  const resolve = target => {
    const t = typeof target === 'string' ? { role: target } : target
    return t.union !== undefined
      ? (t.union.map(resolve).find(el => el !== null) ?? null)
      : t.role !== undefined
        ? ROLES[t.role]()
        : t.section !== undefined
          ? section(t.section)
          : t.text !== undefined
            ? byText(t.text)
            : t.title !== undefined
              ? document.querySelector(`[title^=${JSON.stringify(t.title)}]`)
              : document.querySelector(t.selector)
  }

  const need = target => {
    const el = resolve(target)
    if (el === null) throw new Error(`no element for ${JSON.stringify(target)}`)
    return el
  }

  // Viewport rect of a target, scrolled into view first. `union` spans every
  // listed target, which is how a crop covers a run of sections.
  const rectOf = target => {
    const t = typeof target === 'string' ? { role: target } : target
    const els = (t.union ?? [t]).map(need)
    for (const el of els) {
      if (el.getBoundingClientRect().bottom > innerHeight) {
        el.scrollIntoView({ block: 'center' })
      }
    }
    const boxes = els.map(el => el.getBoundingClientRect())
    const pad = t.pad ?? 0
    const x = Math.min(...boxes.map(b => b.left)) - pad
    const y = Math.min(...boxes.map(b => b.top)) - pad
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(
        innerWidth - Math.max(0, x),
        Math.max(...boxes.map(b => b.right)) + pad - x,
      ),
      height: Math.min(
        innerHeight - Math.max(0, y),
        Math.max(...boxes.map(b => b.bottom)) + pad - y,
      ),
    }
  }

  // React owns these inputs' values, so a bare `el.value = x` is reverted on the
  // next render — go through the native setter and let React's own listener see
  // the event.
  const setInputValue = (el, value) => {
    const proto =
      el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // Callout red, the one color nothing in this dark UI already uses — an amber
  // ring reads as one of the app's own "off stock" lamps.
  const RED = '#ff2f45'
  const svgEl = (name, attrs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
    return el
  }

  // Callouts, drawn over the page just before the shutter: a ring around a
  // region, a numbered badge, a labelled pill, an arrow. Geometry comes from
  // the live elements, so a callout can't drift off the thing it names.
  const annotate = notes => {
    document.getElementById('docshot-overlay')?.remove()
    const svg = svgEl('svg', {
      id: 'docshot-overlay',
      width: innerWidth,
      height: innerHeight,
      style: `position:fixed;inset:0;z-index:99999;pointer-events:none;font-family:system-ui,sans-serif`,
    })
    // Where on a resolved rect a badge or label hangs.
    const corner = (r, at) => ({
      x: at.includes('l')
        ? r.x
        : at.includes('r')
          ? r.x + r.width
          : r.x + r.width / 2,
      y: at.includes('t')
        ? r.y
        : at.includes('b')
          ? r.y + r.height
          : r.y + r.height / 2,
    })
    for (const note of notes) {
      const r = note.target === undefined ? null : rectOf(note.target)
      const dx = note.dx ?? 0
      const dy = note.dy ?? 0
      if (note.box === true) {
        svg.append(
          svgEl('rect', {
            x: r.x - 3,
            y: r.y - 3,
            width: r.width + 6,
            height: r.height + 6,
            rx: 6,
            fill: 'none',
            stroke: RED,
            'stroke-width': 3,
          }),
        )
      }
      // An arrow from the label to the thing labelled, when the two can't touch.
      if (note.from !== undefined) {
        const head = corner(r, note.at ?? 'center')
        const tail = { x: head.x + note.from.x, y: head.y + note.from.y }
        const len = Math.hypot(head.x - tail.x, head.y - tail.y)
        const ux = (head.x - tail.x) / len
        const uy = (head.y - tail.y) / len
        // Stop short of the target so the head points at it rather than into it.
        const tip = { x: head.x - ux * 6, y: head.y - uy * 6 }
        svg.append(
          svgEl('line', {
            x1: tail.x,
            y1: tail.y,
            x2: tip.x - ux * 8,
            y2: tip.y - uy * 8,
            stroke: RED,
            'stroke-width': 3,
            'stroke-linecap': 'round',
          }),
        )
        svg.append(
          svgEl('polygon', {
            points: [
              `${tip.x},${tip.y}`,
              `${tip.x - ux * 14 - uy * 6},${tip.y - uy * 14 + ux * 6}`,
              `${tip.x - ux * 14 + uy * 6},${tip.y - uy * 14 - ux * 6}`,
            ].join(' '),
            fill: RED,
          }),
        )
      }
      if (note.n !== undefined) {
        const p = corner(r, note.at ?? 'tl')
        const g = svgEl('g', {})
        g.append(
          svgEl('circle', {
            cx: p.x + dx,
            cy: p.y + dy,
            r: 15,
            fill: RED,
            stroke: '#16161a',
            'stroke-width': 2,
          }),
        )
        const label = svgEl('text', {
          x: p.x + dx,
          y: p.y + dy + 1,
          fill: '#fff',
          'font-size': 18,
          'font-weight': 700,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
        })
        label.textContent = String(note.n)
        g.append(label)
        svg.append(g)
      }
      if (note.text !== undefined) {
        const p =
          r === null ? { x: note.x, y: note.y } : corner(r, note.at ?? 'tl')
        const width = note.text.length * 8.6 + 24
        const x = Math.min(Math.max(4, p.x + dx), innerWidth - width - 4)
        const y = p.y + dy
        svg.append(
          svgEl('rect', {
            x,
            y: y - 15,
            width,
            height: 30,
            rx: 15,
            fill: RED,
            stroke: '#16161a',
            'stroke-width': 2,
          }),
        )
        const label = svgEl('text', {
          x: x + width / 2,
          y: y + 1,
          fill: '#fff',
          'font-size': 15,
          'font-weight': 600,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
        })
        label.textContent = note.text
        svg.append(label)
      }
    }
    document.body.append(svg)
  }

  window.__ds = {
    rectOf,
    annotate,
    // The element itself, for a caller that has to measure and click the same
    // place — `appreel.mjs` puts a drawn pointer on a target before pressing
    // it, and `rectOf` scrolls, which is a crop's business and not a hand's.
    elementOf: target => need(target),
    click: target => need(target).click(),
    setValue: (target, value) => setInputValue(need(target), value),
    hide: targets => {
      for (const t of targets) need(t).style.display = 'none'
    },
    // Overlay chrome sits on top of the canvas; a picture-only shot drops it.
    bareCanvas: () => {
      const cv = document.querySelector('canvas')
      for (const el of cv.parentElement.children) {
        if (el !== cv) el.style.display = 'none'
      }
    },
    // The stage's own error banner, and the peak channel across the picture: a
    // frame that is dead black everywhere never rendered, and must not be saved
    // as a successful shot.
    health: () => {
      const cv = document.querySelector('canvas')
      const oc = new OffscreenCanvas(cv.width, cv.height)
      const g = oc.getContext('2d')
      g.drawImage(cv, 0, 0)
      let peak = 0
      for (const [x, y] of [
        [0.2, 0.3],
        [0.5, 0.5],
        [0.8, 0.7],
        [0.5, 0.85],
      ]) {
        const d = g.getImageData(
          Math.round(x * cv.width),
          Math.round(y * cv.height),
          1,
          1,
        ).data
        peak = Math.max(peak, d[0], d[1], d[2])
      }
      const err = [...document.querySelectorAll('div[class*="error_"]')]
        .map(el => el.textContent.trim())
        .filter(t => t !== '')
      return { peak, err: err.join(' | ') }
    },
  }
}

// ---------------------------------------------------------------- node side

export const step = (page, frames) =>
  page.evaluate(async n => {
    for (let i = 0; i < n; i++) {
      window.vf?.step()
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 15))
    }
  }, frames)

// One declarative action against the live page. Anything React can't be poked
// into (a drag) goes through the real mouse.
export async function runAction(page, action) {
  if (action.click !== undefined) {
    await page.evaluate(t => window.__ds.click(t), action.click)
  } else if (action.set !== undefined) {
    await page.evaluate(
      (t, v) => window.__ds.setValue(t, v),
      action.set,
      action.value,
    )
  } else if (action.press !== undefined) {
    const keys = action.press.split('+')
    for (const k of keys.slice(0, -1)) await page.keyboard.down(k)
    await page.keyboard.press(keys.at(-1))
    for (const k of keys.slice(0, -1).reverse()) await page.keyboard.up(k)
  } else if (action.drag !== undefined) {
    const r = await page.evaluate(t => window.__ds.rectOf(t), action.drag)
    const x = r.x + r.width / 2
    const y = r.y + r.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    // Several steps, not one jump: the app integrates a drag pointer-move by
    // pointer-move, and a single leap past the slop reads as a click.
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(
        x + (action.by.x * i) / 12,
        y + ((action.by.y ?? 0) * i) / 12,
      )
    }
    await page.mouse.up()
    // Park the pointer off the controls: a chip left under it keeps its hover
    // state, and the panel's caption line would report whatever it landed on
    // rather than the look the shot is of.
    await page.mouse.move(4, 4)
  } else if (action.hide !== undefined) {
    await page.evaluate(t => window.__ds.hide(t), action.hide)
  } else if (action.bare === true) {
    await page.evaluate(() => window.__ds.bareCanvas())
  } else if (action.steps !== undefined) {
    await step(page, action.steps)
  } else if (action.wait !== undefined) {
    await sleep(action.wait)
  }
  await sleep(action.settle ?? 250)
}
