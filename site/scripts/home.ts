// The signed-in home, rendered on top of the landing page at the same URL.
//
// `/` is static HTML and stays that way: the landing markup Astro emits is what
// a stranger gets, and nothing here runs until Firebase has answered. cloud.ts
// loads the SDK on the first call that needs it, so the only page loads that
// fetch anything from Google are the ones that already know this browser signed
// in (`wasSignedIn`) and the ones where somebody pressed the button.
//
// Everything below builds DOM nodes and sets `textContent`. The names, the
// queries and the stills are the reader's own document out of Firestore, and a
// name is a string somebody typed — `innerHTML` anywhere in here would hand
// that string to the parser.
import {
  fetchHome,
  fetchStills,
  signIn,
  signOut,
  wasSignedIn,
  watchAuth,
} from '../../src/ui/cloud'
import { sinceWords } from '../lib/relativeTime'

import type { CloudUser, HomeDoc } from '../../src/ui/cloud'
import type { SavedProfile } from '../../src/ui/profileModel'

// CROSS_REPO_SYNC(home-dom-helpers)
const need = (id: string): HTMLElement => {
  const node = document.getElementById(id)
  if (node === null) throw new Error(`no #${id}`)
  return node
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
// CROSS_REPO_SYNC_END(home-dom-helpers)

const landing = need('landing')
const home = need('home')
const galleryHost = need('galleryHost')
const signInBtn = need('signIn') as HTMLButtonElement
const acct = need('acct')
const acctBtn = need('acctBtn') as HTMLButtonElement
const acctMenu = need('acctMenu')
const acctName = need('acctName')
const avatar = need('avatar')
const signOutBtn = need('signOut') as HTMLButtonElement
const whyCard = need('whyCard') as HTMLDialogElement
const whyBtns = [need('why'), need('whyBelow')]
const whySignInBtn = need('whySignIn') as HTMLButtonElement

// The gallery cards are server-rendered once, inside the landing page, and the
// signed-in home borrows the same <ul>. Copying the markup into the script
// would put every demo's name, still and clip in the bundle a second time.
const galleryCards = galleryHost.firstElementChild

const linkFor = (query: string) => `/app/#${query}`

// PROFILE_SLOTS in profileModel: the number keys recall the first nine, so a
// card past the ninth has no key to name.
const SLOTS = 9

// --- pieces of a card -------------------------------------------------------

// The still of a saved look, or the panel a look with no still gets. A profile
// saved before stills existed, or one whose still has not been written yet,
// shows the app mark on the card's own black.
function shotOf(still: string | undefined): HTMLElement {
  const shot = el('span', 'shot')
  if (still === undefined) {
    shot.classList.add('blank')
    const mark = el('img', 'blankMark')
    mark.src = '/favicon.svg'
    mark.alt = ''
    mark.width = 40
    mark.height = 40
    shot.append(mark)
    return shot
  }
  const img = el('img', 'still')
  img.src = `data:image/webp;base64,${still}`
  img.alt = ''
  img.width = 640
  img.height = 512
  img.loading = 'lazy'
  img.decoding = 'async'
  shot.append(img)
  return shot
}

// The stills arrive after the home is drawn, since they can be most of a
// megabyte between them. Until then a look that may have one gets the card's
// black with nothing on it, and `fillStills` swaps in the picture or the mark.
function shotFor(
  id: string | undefined,
  stills: Map<string, string> | undefined,
): HTMLElement {
  if (id === undefined) return shotOf(undefined)
  if (stills !== undefined) return shotOf(stills.get(id))
  const shot = el('span', 'shot')
  shot.dataset.look = id
  return shot
}

function fillStills(stills: Map<string, string>) {
  for (const shot of home.querySelectorAll<HTMLElement>('[data-look]'))
    shot.replaceWith(shotOf(stills.get(shot.dataset.look ?? '')))
}

function nameRow(name: string): HTMLElement {
  const row = el('span', 'name')
  row.append(document.createTextNode(name), el('span', 'open', 'open →'))
  return row
}

function lookCard(
  profile: SavedProfile,
  stills: Map<string, string> | undefined,
  key: number,
  now: number,
): HTMLElement {
  const item = el('li')
  const link = el('a', 'demo')
  link.href = linkFor(profile.query)
  // A look saved before timestamps existed carries no date to show.
  const says = [
    profile.savedAt === undefined
      ? undefined
      : `saved ${sinceWords(profile.savedAt, now)}`,
    key <= SLOTS ? `key ${key}` : undefined,
  ]
    .filter(part => part !== undefined)
    .join(' · ')
  link.append(
    shotFor(profile.id, stills),
    nameRow(profile.name),
    el('span', 'says', says),
  )
  item.append(link)
  return item
}

function section(id: string, heading: string, sub?: string): HTMLElement {
  const box = el('section', 'homeSec')
  box.id = id
  box.append(el('h2', 'head', heading))
  if (sub !== undefined) box.append(el('p', 'sub', sub))
  return box
}

// --- the three sections -----------------------------------------------------

function resumeSection(
  doc: HomeDoc,
  stills: Map<string, string> | undefined,
  now: number,
) {
  const current = doc.current
  if (current === null) return undefined

  // The still only belongs on this card when the app can prove the session is
  // one of the saved looks: the same query means the same board. A session
  // dialled in since the last save gets the plain panel, because the picture of
  // some other look would be a picture of the wrong thing.
  const match = doc.profiles
    .filter(p => p.query === current.query)
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0]

  const box = section('resume', 'Continue where you left off')
  const card = el('div', 'resumeCard')
  card.append(shotFor(match?.id, stills))

  const body = el('div', 'resumeBody')
  body.append(
    el('p', 'when', sinceWords(current.at, now)),
    el(
      'p',
      'resumeSays',
      'Resuming restores the board, the motion and the cue points, and reloads any video or image that came from a link. A local file, a camera or a screen share has to be picked again.',
    ),
  )
  const row = el('p', 'resumeCta')
  const go = el('a', 'btn primary')
  go.href = linkFor(current.query)
  go.textContent = 'Resume →'
  const fresh = el('a', 'btn')
  fresh.href = '/app/'
  fresh.textContent = 'Start fresh'
  row.append(go, fresh)
  body.append(row)

  card.append(body)
  box.append(card)
  return box
}

function emptyLooks(): HTMLElement {
  const box = el('div', 'empty')
  box.append(
    el('h3', 'emptyHead', 'Nothing saved yet'),
    el(
      'p',
      'emptySays',
      'Open the app, dial something in and press ctrl+S. The look lands here under the name you give it, on every machine you sign in on.',
    ),
  )
  const go = el('a', 'btn primary')
  go.href = '/app/'
  go.textContent = 'Open the app →'
  box.append(go)
  return box
}

function looksSection(
  doc: HomeDoc,
  stills: Map<string, string> | undefined,
  now: number,
) {
  const box = section('saved', 'Your saved looks')
  if (doc.profiles.length === 0) {
    box.append(emptyLooks())
    return box
  }

  // The key a profile answers to is its position in the stored list, which is
  // insertion order — so the key is read before the sort, and the newest save
  // comes first on the page without moving anybody's key.
  const keyed = doc.profiles.map((profile, i) => ({ profile, key: i + 1 }))
  keyed.sort((a, b) => (b.profile.savedAt ?? 0) - (a.profile.savedAt ?? 0))

  const grid = el('ul', 'grid')
  for (const { profile, key } of keyed)
    grid.append(lookCard(profile, stills, key, now))
  box.append(grid)
  return box
}

function failedSection(retry: () => void): HTMLElement {
  const box = section('saved', 'Your saved looks')
  const empty = el('div', 'empty')
  empty.append(
    el('h3', 'emptyHead', 'Your saved looks did not load'),
    el(
      'p',
      'emptySays',
      'The account is signed in, but the request for its looks failed. Check the connection and try again.',
    ),
  )
  const again = el('button', 'btn primary', 'Try again')
  again.type = 'button'
  again.addEventListener('click', retry)
  empty.append(again)
  box.append(empty)
  return box
}

function gallerySection(): HTMLElement {
  const box = section(
    'gallery',
    'From the gallery',
    'Open one and you land on that exact board.',
  )
  if (galleryCards !== null) box.append(galleryCards)
  return box
}

// --- the account end of the bar ---------------------------------------------

// CROSS_REPO_SYNC(home-account)
function paintAvatar(user: CloudUser) {
  avatar.textContent = ''
  avatar.classList.remove('initial')
  const name = user.name ?? ''
  const initial = () => {
    avatar.textContent = (name.trim()[0] ?? '?').toUpperCase()
    avatar.classList.add('initial')
  }
  if (user.photo === null) initial()
  else {
    const img = el('img')
    img.src = user.photo
    img.alt = ''
    img.width = 28
    img.height = 28
    // Google serves an avatar only to a request that names no referrer.
    img.referrerPolicy = 'no-referrer'
    img.addEventListener('error', initial)
    avatar.append(img)
  }
  acctName.textContent = name === '' ? 'Signed in' : name
  acctBtn.setAttribute('aria-label', name === '' ? 'Account' : name)
}

const closeMenu = () => {
  acctMenu.hidden = true
  acctBtn.setAttribute('aria-expanded', 'false')
}

acctBtn.addEventListener('click', event => {
  event.stopPropagation()
  acctMenu.hidden = !acctMenu.hidden
  acctBtn.setAttribute('aria-expanded', String(!acctMenu.hidden))
})
document.addEventListener('click', closeMenu)
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu()
})

// --- why sign in ------------------------------------------------------------

// index.astro writes the card into the page at build time. This opens it, shuts
// it, and hands its button to the sign-in the bar's button uses.
for (const button of whyBtns)
  button.addEventListener('click', () => {
    whyCard.showModal()
  })

need('whyClose').addEventListener('click', () => {
  whyCard.close()
})

whyCard.addEventListener('click', event => {
  // A press that landed on the dialog element and on none of its children
  // landed on the backdrop.
  if (event.target === whyCard) whyCard.close()
})
// CROSS_REPO_SYNC_END(home-account)

// --- the two states ---------------------------------------------------------

// The landing page's gallery section gives up its id while the home is up, so
// `#gallery` names the home's section and the page has one element per id.
const landingGallery = galleryHost.closest('section')

// Counts renders, so stills that arrive after a sign-out or a second paint are
// dropped.
let turn = 0

function settle() {
  turn++
  const root = document.documentElement
  if (root.dataset.home !== 'pending') return
  delete root.dataset.home
  // A link to `/#gallery` arrived while the skeleton hid its target, so the
  // browser had nothing to scroll to.
  if (location.hash !== '')
    document.getElementById(location.hash.slice(1))?.scrollIntoView()
}

function showFrame(user: CloudUser, sections: HTMLElement[]) {
  paintAvatar(user)
  whyCard.close()
  signInBtn.hidden = true
  for (const button of whyBtns) button.hidden = true
  acct.hidden = false

  const rail = el('nav', 'rail')
  rail.setAttribute('aria-label', 'Home')
  for (const [href, label, on] of [
    ['/', 'Home', true],
    ['#saved', 'Saved looks', false],
    ['#gallery', 'Gallery', false],
    ['/guide/', 'User guide', false],
  ] as [string, string, boolean][]) {
    const link = el('a', on ? 'on' : undefined, label)
    link.href = href
    if (on) link.setAttribute('aria-current', 'page')
    rail.append(link)
  }

  const main = el('div', 'homeMain')
  main.append(...sections, gallerySection())

  const inner = el('div', 'homeIn')
  inner.append(rail, main)
  landingGallery?.removeAttribute('id')
  home.textContent = ''
  home.append(inner)
  home.hidden = false
  landing.hidden = true
  settle()
}

// `stills` left out draws the home without them; `fillStills` adds them.
export function showHome(
  user: CloudUser,
  doc: HomeDoc,
  stills?: Map<string, string>,
  now = Date.now(),
): void {
  const resume = resumeSection(doc, stills, now)
  const looks = looksSection(doc, stills, now)
  showFrame(user, resume === undefined ? [looks] : [resume, looks])
}

export function showLanding(): void {
  closeMenu()
  acct.hidden = true
  signInBtn.hidden = false
  for (const button of whyBtns) button.hidden = false
  // The gallery <ul> goes back where Astro rendered it, so the landing page is
  // whole again without a reload.
  if (galleryCards !== null) galleryHost.append(galleryCards)
  landingGallery?.setAttribute('id', 'gallery')
  home.textContent = ''
  home.hidden = true
  landing.hidden = false
  settle()
}

async function paint(user: CloudUser) {
  let doc: HomeDoc
  try {
    doc = await fetchHome(user.uid)
  } catch {
    showFrame(user, [failedSection(() => void paint(user))])
    return
  }
  showHome(user, doc)
  const drawn = turn
  const stills = await fetchStills(user.uid).catch(
    () => new Map<string, string>(),
  )
  if (drawn === turn) fillStills(stills)
}

// CROSS_REPO_SYNC(home-sign-in)
let signedIn: CloudUser | null = null

const startSignIn = (button: HTMLButtonElement) => {
  button.disabled = true
  signIn()
    .then(user => {
      signedIn = user
      return paint(user)
    })
    .catch(() => {
      // A popup the reader closed, or one the browser blocked. The page is the
      // landing page already and there is nothing to report.
    })
    .finally(() => {
      button.disabled = false
    })
}

signInBtn.addEventListener('click', () => {
  startSignIn(signInBtn)
})

whySignInBtn.addEventListener('click', () => {
  startSignIn(whySignInBtn)
})

signOutBtn.addEventListener('click', () => {
  signedIn = null
  showLanding()
  void signOut()
})

// Back from /app/ restores this page from the back-forward cache as it was, so
// a look saved in the app would be missing until a reload.
addEventListener('pageshow', event => {
  if (event.persisted && signedIn !== null) void paint(signedIn)
})

// The one path that costs a page load anything: a browser that has signed in
// before subscribes on load, which is what fetches the SDK. Everyone else waits
// for the button. A failure here is the SDK failing to load, and a page with no
// SDK can only be the landing page.
if (wasSignedIn())
  watchAuth(user => {
    signedIn = user
    if (user === null) showLanding()
    else void paint(user)
  }).catch(showLanding)
// CROSS_REPO_SYNC_END(home-sign-in)
