// Two rules hold everything below together. One clip moves at a time —
// the hero's, or a card's, never eleven of them at once — and nothing is
// fetched until it is about to be looked at. `data-src`/`data-clip` are
// page-relative on purpose: vite rewrites the asset attributes it knows,
// and it has never heard of a data attribute, so a root-absolute one
// would survive the build unchanged and, under a sub-path base, give a
// card a working still over a clip that 404s. The landing page is the
// root, so `demos/…` is the same URL here and right everywhere.
//
// Everything degrades to the stills if it does not run.
const motion = matchMedia('(prefers-reduced-motion: reduce)')

// ---- can this browser run it at all ----
//
// Two questions, not one. `navigator.gpu` is whether the browser has the
// API; `requestAdapter()` is whether there is a GPU it will hand over,
// which is a different answer on a blocklisted driver or a Linux build
// with the API present and switched off — and it is the second one the
// app dies of. An adapter is not a device: nothing here creates one, so
// this costs the page a promise and leaves the app's own session
// untouched (docs/adr/0004).
{
  const warn = document.querySelector('.gpuwarn')
  const say = () => {
    warn.hidden = false
  }
  if (navigator.gpu === undefined) {
    say()
  } else {
    navigator.gpu
      .requestAdapter()
      .then(adapter => {
        if (adapter === null) {
          say()
        }
      })
      .catch(() => say())
  }
}

// ---- the carousel ----
//
// Recordings of the app's own window, one showing at a time. It plays on
// its own once it is on screen and stops when it is not — there is no
// Play button, because the stage is the one thing on this page a stranger
// cannot read as a video until it moves, and a control that has to be
// found first is a control that answers the question too late.
//
// Nothing is fetched until the slide holding it is the one showing. A
// reader who asked for reduced motion is handed the stills and the tabs,
// and steps through them by hand: the tabs are the way in for everybody,
// so there is no path here that only one kind of reader can walk.
//
// The tabs and the captions are read off the slides rather than written
// beside them, so a slide added to the reel arrives with its own way in
// and its own line — and each slide carries how long its own recording
// runs, because they are timelines of different lengths and a stage that
// advances on a fixed clock cuts one of them off mid-drag.
{
  const stage = document.querySelector('.stage')
  const slides = [...stage.querySelectorAll('.slide')]
  // Which of the two recordings to play, asked of the markup rather than
  // repeated here: the browser has already used this query to pick the
  // still that gives the stage its shape, so reading it back is what
  // keeps the clip on the same side of it as the box it plays in.
  const narrow = matchMedia(stage.querySelector('source').media)
  const pick = el => (narrow.matches ? el.dataset.srcNarrow : el.dataset.src)
  // The portrait take can run a beat longer than the wide one — it
  // scrolls to what the wide frame can already see — so a slide carries
  // both lengths.
  const secsOf = slide =>
    narrow.matches ? slide.dataset.secsNarrow : slide.dataset.secs
  const notes = [...document.querySelectorAll('.slideNote')]
  const tabs = document.querySelector('.slideTabs')
  // Long enough after the clip has run once to read the line under it.
  const READING = 2500

  let at = 0
  // False until the observer below says otherwise, which is what keeps
  // the first clip off the arrival path: the stage is under the fold on
  // most windows, and starting at `true` fetched it while the page was
  // still painting. The observer reports the real answer on the next
  // frame either way, so a stage that *is* in view loses nothing.
  let inView = false
  let advance = 0
  // Pressed the Play button below, which is the reader asking for the
  // reel in so many words — the same thing hover is on a gallery card,
  // and it outranks the preference for the same reason.
  let asked = false

  // Stored only where there is nothing to ask. Whether the tab is
  // showing and whether the reader wants motion are *asked* rather than
  // stored, because the event that reports the stage's own state is the
  // observer's: folding `document.hidden` into `inView` on a
  // visibilitychange said a scrolled-past stage was in view every time
  // the reader came back to the tab, and set it playing off screen.
  const running = () => inView && !document.hidden && (!motion.matches || asked)

  // One clip decodes at a time, and it is the one being looked at. The
  // `live` class lands on the promise rather than beside it, so a clip
  // still opening is never faded up over the still it is there to
  // replace.
  const cue = () => {
    for (const [i, slide] of slides.entries()) {
      const clip = slide.querySelector('video')
      if (clip) {
        if (i === at && running()) {
          if (!clip.src) {
            clip.src = pick(clip)
          }
          clip
            .play()
            .then(() => slide.classList.add('live'))
            .catch(() => {})
        } else {
          clip.pause()
        }
      }
    }
  }

  const show = index => {
    at = index
    for (const [i, slide] of slides.entries()) {
      slide.classList.toggle('on', i === at)
      notes[i].classList.toggle('on', i === at)
      buttons[i].setAttribute('aria-current', String(i === at))
    }
    // The still under the clip, fetched the first time its slide is
    // reached. Here rather than in `cue()` below, because a reader who
    // asked for reduced motion never reaches `cue()` and the still is the
    // whole of what they are being shown.
    const still = slides[at].querySelector('.still')
    if (!still.getAttribute('src')) {
      still.src = pick(still)
    }
  }

  const sync = () => {
    clearTimeout(advance)
    if (running() && slides.length > 1) {
      advance = setTimeout(
        () => {
          show((at + 1) % slides.length)
          sync()
        },
        Number(secsOf(slides[at])) * 1000 + READING,
      )
    }
    cue()
  }

  const buttons = slides.map((slide, i) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip slideTab'
    button.textContent = slide.dataset.name
    button.addEventListener('click', () => {
      show(i)
      sync()
    })
    tabs.append(button)
    return button
  })

  // The way into the reel for a reader who asked for reduced motion, who
  // is otherwise handed a box that never moves. The button is the stage
  // itself rather than a control beside it, so the thing that has to be
  // found is the size of the picture, and it says what it does on
  // `aria-label` rather than in the glyph.
  const veil = document.createElement('button')
  veil.type = 'button'
  veil.className = 'stageVeil'
  veil.innerHTML =
    '<svg class="stageIcon" viewBox="0 0 100 100" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="46" />' +
    '<path class="stagePlayMark" d="M41 31 L72 50 L41 69 Z" />' +
    '<path class="stagePauseMark" d="M38 32h10v36h-10zM52 32h10v36h-10z" />' +
    '</svg>'
  const name = () => {
    veil.setAttribute('aria-label', asked ? 'Pause the reel' : 'Play the reel')
    veil.classList.toggle('off', asked)
  }
  veil.addEventListener('click', () => {
    asked = !asked
    name()
    sync()
  })
  name()
  stage.append(veil)

  motion.addEventListener('change', () => sync())
  document.addEventListener('visibilitychange', () => sync())
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting
    sync()
  }).observe(stage)
  show(0)
  sync()
}

// ---- the gallery ----
//
// One card plays, and it is the one being looked at: the card under the
// pointer or holding focus, and on a touchscreen the card crossing the
// middle of the screen. Hover and focus start a clip whatever the motion
// preference says, because both of them are something the reader did.
const cards = [...document.querySelectorAll('.demo')]
let live

const activate = card => {
  if (live !== card) {
    if (live) {
      live.classList.remove('live')
      live.querySelector('video').pause()
    }
    live = card
    if (card) {
      const clip = card.querySelector('video')
      if (!clip.src) {
        clip.src = clip.dataset.src
      }
      // The class lands on the promise rather than beside it, so a clip
      // that is still opening never gets faded up over the still it is
      // there to replace.
      clip
        .play()
        .then(() => card.classList.add('live'))
        .catch(() => {})
    }
  }
}

for (const card of cards) {
  card.addEventListener('pointerenter', () => activate(card))
  card.addEventListener('pointerleave', () => activate(undefined))
  card.addEventListener('focus', () => activate(card))
  card.addEventListener('blur', () => activate(undefined))
}

if (!motion.matches && matchMedia('(hover: none)').matches) {
  const band = new Set()
  const crossing = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          band.add(entry.target)
        } else {
          band.delete(entry.target)
        }
      }
      activate([...band][0])
    },
    { rootMargin: '-40% 0px -40% 0px' },
  )
  for (const card of cards) {
    crossing.observe(card)
  }
}
