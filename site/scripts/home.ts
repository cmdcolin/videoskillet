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
  SESSION_STILL,
  fetchHome,
  fetchStill,
  fetchStills,
  signIn,
  signOut,
  warmSignIn,
  wasSignedIn,
  watchAuth,
} from '../../src/ui/cloud'
import { sinceWords } from '../lib/relativeTime'

import type { CloudUser, HomeDoc, Still } from '../../src/ui/cloud'
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
const whyTrouble = need('whyTrouble')

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

// Which still a card shows: `id`'s when it was taken no earlier than `since`,
// and otherwise `or`'s.
interface StillPick {
  id?: string
  since?: number
  or?: string
}

function pickStill(
  stills: Map<string, Still>,
  pick: StillPick,
): string | undefined {
  const own = pick.id === undefined ? undefined : stills.get(pick.id)
  if (own !== undefined && own.at >= (pick.since ?? 0)) return own.webp
  return pick.or === undefined ? undefined : stills.get(pick.or)?.webp
}

// The stills arrive after the home is drawn, since they can be most of a
// megabyte between them. Until then a look that may have one gets the card's
// black with nothing on it. Every shot keeps its pick, so `fillStills` can swap
// in the picture, the mark, or a newer picture on a return by Back.
function shotFor(
  pick: StillPick,
  stills: Map<string, Still> | undefined,
): HTMLElement {
  if (pick.id === undefined && pick.or === undefined) return shotOf(undefined)
  const shot =
    stills === undefined ? el('span', 'shot') : shotOf(pickStill(stills, pick))
  if (pick.id !== undefined) shot.dataset.look = pick.id
  if (pick.since !== undefined) shot.dataset.since = String(pick.since)
  if (pick.or !== undefined) shot.dataset.or = pick.or
  return shot
}

function fillStills(stills: Map<string, Still>) {
  for (const shot of home.querySelectorAll<HTMLElement>(
    '.shot[data-look], .shot[data-or]',
  )) {
    const { look, since, or } = shot.dataset
    const pick = {
      id: look,
      since: since === undefined ? undefined : Number(since),
      or,
    }
    const webp = pickStill(stills, pick)
    const img = shot.querySelector<HTMLImageElement>('img.still')
    const same =
      webp === undefined
        ? shot.classList.contains('blank')
        : img?.src === `data:image/webp;base64,${webp}`
    if (!same) shot.replaceWith(shotFor(pick, stills))
  }
}

function nameRow(name: string): HTMLElement {
  const row = el('span', 'name')
  row.append(document.createTextNode(name), el('span', 'open', 'open →'))
  return row
}

function lookCard(
  profile: SavedProfile,
  stills: Map<string, Still> | undefined,
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
    shotFor({ id: profile.id }, stills),
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
  stills: Map<string, Still> | undefined,
  now: number,
) {
  const current = doc.current
  if (current === null) return undefined

  // The session's own still, when it was taken after the session was written.
  // A session written from a hidden tab has none, and an older still is a
  // picture of an earlier board. A saved look with the same query is the same
  // board, so its still serves next; failing both, the card shows the mark.
  const match = doc.profiles
    .filter(p => p.query === current.query)
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0]

  const box = section('resume', 'Continue where you left off')
  const card = el('div', 'resumeCard')
  card.append(
    shotFor({ id: SESSION_STILL, since: current.at, or: match?.id }, stills),
  )

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
  stills: Map<string, Still> | undefined,
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

  const grid = el('ul', 'grid looks')
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
// A disclosure, so Escape hands focus back to the button that opened it.
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || acctMenu.hidden) return
  closeMenu()
  acctBtn.focus()
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
  stills?: Map<string, Still>,
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

// The stills the last paint fetched, for the account they belong to. A return
// from the app by Back paints again, and every still coming down a second time
// was most of a megabyte for the one or two that can have changed.
let stillCache: { uid: string; stills: Map<string, Still> } | undefined

// The stills `doc` needs that `stills` has no copy of as new as the save: a
// profile saved since, and the session when it was written since. The still is
// written after the entry it belongs to, from the same machine's clock.
function staleStills(doc: HomeDoc, stills: Map<string, Still>): string[] {
  const behind = (id: string, at: number) => (stills.get(id)?.at ?? -1) < at
  const ids = doc.profiles.flatMap(p =>
    p.id !== undefined && p.savedAt !== undefined && behind(p.id, p.savedAt)
      ? [p.id]
      : [],
  )
  if (doc.current !== null && behind(SESSION_STILL, doc.current.at))
    ids.push(SESSION_STILL)
  return ids
}

async function freshen(
  uid: string,
  doc: HomeDoc,
  cached: Map<string, Still>,
): Promise<Map<string, Still>> {
  const stills = new Map(cached)
  await Promise.all(
    staleStills(doc, cached).map(id =>
      fetchStill(uid, id).then(
        still => {
          if (still !== undefined) stills.set(id, still)
        },
        () => undefined,
      ),
    ),
  )
  return stills
}

async function paint(user: CloudUser) {
  let doc: HomeDoc
  try {
    doc = await fetchHome(user.uid)
  } catch {
    showFrame(user, [failedSection(() => void paint(user))])
    return
  }
  const cached = stillCache?.uid === user.uid ? stillCache.stills : undefined
  showHome(user, doc, cached)
  const drawn = turn
  const stills =
    cached === undefined
      ? await fetchStills(user.uid).catch(() => undefined)
      : await freshen(user.uid, doc, cached)
  if (drawn !== turn) return
  if (stills !== undefined) stillCache = { uid: user.uid, stills }
  fillStills(stills ?? new Map())
}

// CROSS_REPO_SYNC(home-sign-in)
let signedIn: CloudUser | null = null

// Whether the subscription at the bottom is installed. It paints a sign-in by
// itself, and a second paint from the button fetched the whole home twice.
const watching = wasSignedIn()

// What the why card says about a sign-in that did not finish, or undefined for
// a popup the reader closed: they changed their mind, and the page they are
// looking at is already the right one.
function signInTrouble(e: unknown): string | undefined {
  const code = typeof e === 'object' && e !== null && 'code' in e ? e.code : ''
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  )
    return undefined
  if (code === 'auth/popup-blocked')
    return 'The browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
  return 'Signing in did not finish. Check the connection and try again.'
}

const startSignIn = (button: HTMLButtonElement) => {
  button.disabled = true
  whyTrouble.hidden = true
  signIn()
    .then(user => {
      signedIn = user
      return watching ? undefined : paint(user)
    })
    .catch((e: unknown) => {
      const trouble = signInTrouble(e)
      if (trouble === undefined) return
      console.error('sign-in failed', e)
      whyTrouble.textContent = trouble
      whyTrouble.hidden = false
      if (!whyCard.open) whyCard.showModal()
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

for (const button of [signInBtn, whySignInBtn, ...whyBtns])
  for (const type of ['pointerenter', 'focus'])
    button.addEventListener(type, warmSignIn, { once: true })

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
