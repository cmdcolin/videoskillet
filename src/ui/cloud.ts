import {
  PROFILE_MAX,
  pushRecent,
  readProfiles,
  readRecent,
  removeRecent,
} from './profileModel'
import { readStored, removeStored, writeString } from './storage'

import type { RatingRecord } from '../labels'
import type { CandidateRecord, VoteRecord } from '../vote/votes'
import type { RecentSession, SavedProfile } from './profileModel'
import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore/lite'

// The whole Firebase surface: sign-in, the one document a signed-in user keeps
// their saved profiles and last session in, and the stills under it. Nothing
// else in the app imports `firebase`.
//
// **Every firebase import in here is dynamic, and that is the point.** The three
// entry points come to ~110kB gzipped, which is most of a WebGPU app's budget
// before the first frame — and the overwhelming majority of sessions never sign
// in at all. So the SDK is fetched on the first call that actually needs it: a
// press on "sign in", or a page load that already knows this browser was signed
// in (see SIGNED_IN_HINT). A session that never does either downloads none of it.
//
// Type-only imports above are free — they are erased before the bundler sees
// them, so naming Auth or User here costs nothing at runtime.
//
// The config is committed on purpose. A Firebase web config is a set of public
// identifiers, not credentials: it ships inside the bundle of every Firebase web
// app that has ever been deployed, and the apiKey only identifies the project to
// Google's endpoints. What stops a stranger writing to the database is
// firestore.rules, and what stops one using the project as their own auth backend
// is the authorized-domains list. This is the same call phyloguessr makes, and it
// is what lets the GitHub Pages workflow build with no secrets — ytshuffle2 reads
// the config from VITE_ vars its CI does not set, so the bundle it deploys
// carries `undefined` for all seven fields.
// CROSS_REPO_SYNC(firebase-config)
const CONFIG = {
  apiKey: 'AIzaSyBHZnQdnaDc5BEYbqwKO8zs0t_wyzLaGFo',
  authDomain: 'ntscjs-d4f56.firebaseapp.com',
  projectId: 'ntscjs-d4f56',
  storageBucket: 'ntscjs-d4f56.firebasestorage.app',
  messagingSenderId: '881016589781',
  appId: '1:881016589781:web:9eabd469a30d89b6d7815c',
  measurementId: 'G-ZFH59EM495',
}
// CROSS_REPO_SYNC_END(firebase-config)

const COLLECTION = 'users'

// Whether this browser has been signed in before. Not a credential and not
// trusted for anything — the real session lives in Firebase's own IndexedDB
// store, and this is only the hint that tells a fresh page load whether it is
// worth fetching the SDK to go and look. Wrong in the harmless direction either
// way: stale-true costs one wasted fetch, stale-false costs one click.
export const SIGNED_IN_HINT = 'videoskillet_signed_in'

// The reCAPTCHA Enterprise key App Check attests with, from the Firebase console's
// App Check page. Public in the same way the config above is: it names the site
// to Google's reCAPTCHA endpoint, and what it buys is a token saying a request
// came from this app. Empty until somebody registers one, and an empty key
// installs nothing — requests then carry no App Check token, which is what every
// session has sent since the project was created.
//
// Outside the shared region because each site attests as itself.
const APPCHECK_SITE_KEY = '6LfXUr8tAAAAAAWJh1jC0NfYTmhiAmdq-Nd8c9nQ'

// Attest that a request comes from this app, before the first one goes.
//
// firestore.rules says who may write what, and it cannot say what is making the
// request: the web config is public by design (docs/adr/0005), so anyone can
// sign in with a Google account and write from a script. App Check is what
// bounds that, and it started mattering when the project moved to a paid plan —
// a loop of writes is a bill there, where on the free plan it stopped at the
// day's quota. docs/adr/0011 has the rest, including why the rules do not try to
// rate limit.
//
// Dynamic like every other firebase import here, and reached only when a key is
// set, so a build without one fetches none of it.
async function installAppCheck(app: FirebaseApp, siteKey: string) {
  if (siteKey === '') return
  const mod = await import('firebase/app-check')
  mod.initializeAppCheck(app, {
    provider: new mod.ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

// CROSS_REPO_SYNC(firebase-auth)
export const wasSignedIn = () => readStored(SIGNED_IN_HINT) === '1'

// What the panel needs to know about who is signed in. Deliberately not the
// firebase User: that object carries tokens and a dozen methods, and the only
// things any component here shows are a name and an avatar.
export interface CloudUser {
  uid: string
  name: string | null
  photo: string | null
}

const asCloudUser = (user: User): CloudUser => ({
  uid: user.uid,
  name: user.displayName,
  photo: user.photoURL,
})

interface Sdk {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  fs: typeof import('firebase/firestore/lite')
  authMod: typeof import('firebase/auth')
}

// One SDK per page, and one *load* per page even when several callers race for
// it: the promise is the singleton, not the resolved value. initializeApp throws
// on a second call with the same name, and the auth instance has to be the same
// object the sign-in popup resolved against.
let sdk: Promise<Sdk> | null = null

function loadSdk(): Promise<Sdk> {
  if (sdk !== null) return sdk
  const load = (async () => {
    const [appMod, authMod, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      // The `lite` build, as in both of the other projects here: it drops
      // onSnapshot and the offline queue, which this app has no use for. A
      // profile list is read once when a session signs in and written when the
      // user presses save — there is no live document to subscribe to, and a
      // second device's changes matter at the next load, not mid-set.
      import('firebase/firestore/lite'),
    ])
    const app = appMod.initializeApp(CONFIG)
    await installAppCheck(app, APPCHECK_SITE_KEY)
    return {
      app,
      auth: authMod.getAuth(app),
      db: fs.getFirestore(app),
      fs,
      authMod,
    }
  })()
  sdk = load
  // A download that failed, offline or on a flaky connection, is let go, so the
  // next press tries again instead of failing until a reload.
  load.catch(() => {
    if (sdk === load) sdk = null
  })
  return load
}

// Starts the SDK downloading ahead of a sign-in. The popup can only open inside
// the browser's allowance for the click that asked for it, and a first sign-in
// on a slow connection spent that allowance on the download, so the browser
// blocked the window. Pointing at a sign-in button is reason enough to fetch.
export const warmSignIn = (): void => {
  loadSdk().catch(() => undefined)
}

// Subscribe to who is signed in. Resolves to the unsubscribe once the SDK is up;
// the callback fires immediately after that with the restored session (or null),
// and again on every sign-in and sign-out.
export async function watchAuth(
  onUser: (user: CloudUser | null) => void,
): Promise<() => void> {
  const { auth, authMod } = await loadSdk()
  return authMod.onAuthStateChanged(auth, user => {
    if (user === null) removeStored(SIGNED_IN_HINT)
    else writeString(SIGNED_IN_HINT, '1')
    onUser(user === null ? null : asCloudUser(user))
  })
}

// A popup rather than a redirect, like both of the other projects. A redirect
// would take the tab away and come back to a cold page — which in this app means
// tearing down a GPUDevice and building another one to sign in, and every device
// this tab spends is one it does not get back (docs/adr/0004).
export async function signIn(): Promise<CloudUser> {
  const { auth, authMod } = await loadSdk()
  const provider = new authMod.GoogleAuthProvider()
  const result = await authMod.signInWithPopup(auth, provider)
  writeString(SIGNED_IN_HINT, '1')
  return asCloudUser(result.user)
}

export async function signOut(): Promise<void> {
  const { auth } = await loadSdk()
  removeStored(SIGNED_IN_HINT)
  await auth.signOut()
}
// CROSS_REPO_SYNC_END(firebase-auth)

// CROSS_REPO_SYNC(saved-list-cloud)
// Everything the user document holds: the saved profiles and the sessions last
// left open. Read through the same sanitizers the list has always used, because
// a document is exactly as untrusted as a localStorage value was: it can carry a
// shape written by an older version of this app, or by a hand-rolled request.
export interface HomeDoc {
  profiles: SavedProfile[]
  recent: RecentSession[]
}

export async function fetchHome(uid: string): Promise<HomeDoc> {
  const { db, fs } = await loadSdk()
  const snap = await fs.getDoc(fs.doc(db, COLLECTION, uid))
  if (!snap.exists()) return { profiles: [], recent: [] }
  const data = snap.data()
  return {
    profiles: readProfiles(data.profiles),
    recent: readRecent(data.recent, data.current),
  }
}

// Firestore refuses a field set to undefined, so an entry is built from the
// fields it has.
const profileEntry = (item: SavedProfile) => ({
  name: item.name,
  query: item.query,
  ...(item.id === undefined ? {} : { id: item.id }),
  ...(item.savedAt === undefined ? {} : { savedAt: item.savedAt }),
})

// Applies `edit` to the stored list and writes the result in one transaction.
// Firestore reruns `edit` when another write lands between the read and the
// write, so `edit` must be pure. A caller that builds the list from its own
// copy drops whatever another tab, device or pending write added. Merged, so
// the write keeps the sessions.
export async function editProfiles(
  uid: string,
  edit: (profiles: SavedProfile[]) => SavedProfile[],
): Promise<SavedProfile[]> {
  const { db, fs } = await loadSdk()
  const ref = fs.doc(db, COLLECTION, uid)
  return fs.runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const stored = snap.exists() ? readProfiles(snap.data().profiles) : []
    const next = edit(stored).slice(0, PROFILE_MAX)
    tx.set(ref, { profiles: next.map(profileEntry) }, { merge: true })
    return next
  })
}

// Puts `entry` at the front of the recent sessions in one transaction, merged
// for the same reason, and resolves to the ids that left the list. The write
// removes `current`, the single session older builds kept, since the list read
// it in.
export async function putSession(
  uid: string,
  entry: RecentSession,
): Promise<string[]> {
  const { db, fs } = await loadSdk()
  const ref = fs.doc(db, COLLECTION, uid)
  return fs.runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const data = snap.exists() ? snap.data() : undefined
    const { recent, dropped } = pushRecent(
      readRecent(data?.recent, data?.current),
      entry,
    )
    tx.set(
      ref,
      {
        recent: recent.map(s => ({ id: s.id, query: s.query, at: s.at })),
        current: fs.deleteField(),
      },
      { merge: true },
    )
    return dropped
  })
}

// Removes one session in the same kind of transaction, and resolves to the
// list that landed.
export async function dropSession(
  uid: string,
  id: string,
): Promise<RecentSession[]> {
  const { db, fs } = await loadSdk()
  const ref = fs.doc(db, COLLECTION, uid)
  return fs.runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const data = snap.exists() ? snap.data() : undefined
    const recent = removeRecent(readRecent(data?.recent, data?.current), id)
    tx.set(
      ref,
      { recent: recent.map(s => ({ id: s.id, query: s.query, at: s.at })) },
      { merge: true },
    )
    return recent
  })
}
// CROSS_REPO_SYNC_END(saved-list-cloud)

// The saved profiles on this account, or [] for an account that has never saved
// one.
export const fetchProfiles = async (uid: string): Promise<SavedProfile[]> =>
  (await fetchHome(uid)).profiles

// A profile's still: a small webp as base64, one document per profile under the
// user, keyed by the profile's id. A subcollection rather than a field on the
// entry because the user document is capped at 1 MiB and two hundred stills
// would pass it; one document per still also means the home page fetches them
// in one query while a save writes one.
export const STILL_MAX = 60000

// A recent session's still, beside the profiles' own. A profile id is base36,
// so no profile can have one of these. The session older builds kept, which
// reads back with an empty id, wrote its still under the bare prefix.
const SESSION_STILL = '_session'

export const sessionStill = (id: string): string =>
  id === '' ? SESSION_STILL : `${SESSION_STILL}-${id}`

// The board a still is a picture of, as a 32-bit FNV-1a hash in base36. A
// session entry is rewritten in place every time the board settles, and the
// write made from a hidden tab carries no new picture, so comparing clocks
// calls a good still stale as soon as a still-less write moves the session on.
// Comparing boards is the question the card is actually asking.
export function stillTag(query: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < query.length; i++)
    h = Math.imul(h ^ query.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

export interface Still {
  webp: string
  at: number
  // Absent on a still written before tagging, and on a saved look's, which is
  // rewritten with the look it belongs to and so cannot fall behind it.
  q?: string
}

const readStill = (
  data: { webp?: unknown; at?: unknown; q?: unknown } | undefined,
) =>
  typeof data?.webp === 'string' && typeof data.at === 'number'
    ? {
        webp: data.webp,
        at: data.at,
        ...(typeof data.q === 'string' ? { q: data.q } : {}),
      }
    : undefined

// Whether a still is a picture of the board a card is offering. A tagged still
// matches the board or it does not; one written before tagging falls back to
// the clock, which is the test this replaces — see `stillTag` for why the clock
// alone gets it wrong.
export const stillShows = (
  still: Still,
  want: { q?: string; since?: number },
): boolean =>
  still.q !== undefined && want.q !== undefined
    ? still.q === want.q
    : still.at >= (want.since ?? 0)

export async function putStill(
  uid: string,
  id: string,
  webp: string,
  q?: string,
): Promise<void> {
  const { db, fs } = await loadSdk()
  await fs.setDoc(fs.doc(db, COLLECTION, uid, 'stills', id), {
    webp,
    at: Date.now(),
    ...(q === undefined ? {} : { q }),
  })
}

export async function deleteStill(uid: string, id: string): Promise<void> {
  const { db, fs } = await loadSdk()
  await fs.deleteDoc(fs.doc(db, COLLECTION, uid, 'stills', id))
}

// Every still on the account, by profile id.
export async function fetchStills(uid: string): Promise<Map<string, Still>> {
  const { db, fs } = await loadSdk()
  const snap = await fs.getDocs(fs.collection(db, COLLECTION, uid, 'stills'))
  const stills = new Map<string, Still>()
  for (const d of snap.docs) {
    const still = readStill(d.data())
    if (still !== undefined) stills.set(d.id, still)
  }
  return stills
}

// One still, or undefined when there is none.
export async function fetchStill(
  uid: string,
  id: string,
): Promise<Still | undefined> {
  const { db, fs } = await loadSdk()
  const snap = await fs.getDoc(fs.doc(db, COLLECTION, uid, 'stills', id))
  return readStill(snap.data())
}

// --- the vote page's training data (src/vote) ---
//
// These live here rather than in src/vote for one reason: `loadSdk` above is a
// singleton promise, and it has to stay the *same* one — initializeApp throws on
// a second call and the auth instance has to be the object the sign-in popup
// resolved against. Exporting it so the vote page could build its own writer
// would also break the claim at the top of this file, which is worth keeping
// true: nothing else in the app imports firebase. The record types come in
// type-only, so this direction of dependency costs nothing at runtime.

// One candidate, keyed by the hash of its recipe.
//
// Create-only by rule, so writing one that already exists is denied — and that
// is the expected case, not an error: two people rolling the same look write the
// same id, and the document already there says exactly what this one would.
// Swallowed for that reason. A genuine failure (offline, rules rejected the
// shape) is swallowed too, which is the right call for this specific write: a
// candidate is a convenience row for the training export, the vote itself
// carries the pair seed that regenerates both sides, and failing a vote because
// its candidate row did not land would lose the label that actually matters.
export async function putCandidate(
  uid: string,
  candidate: CandidateRecord,
): Promise<void> {
  try {
    const { db, fs } = await loadSdk()
    await fs.setDoc(fs.doc(db, 'candidates', candidate.id), {
      v: candidate.v,
      id: candidate.id,
      seed: candidate.seed,
      kind: candidate.kind,
      weights: candidate.weights,
      query: candidate.query,
      by: uid,
      sat: fs.serverTimestamp(),
    })
  } catch {
    // See above: already-there is the common case and nothing here is load-bearing.
  }
}

// The votes that landed, so the caller can clear exactly those from its queue.
//
// Sequential rather than a batch, and that is deliberate: a batch is atomic, so
// one malformed row would reject the whole flush and a labeller's whole session
// with it. Written one at a time, a bad row costs itself and the rest still
// land. `by` and `sat` are added here because the rules pin them — a client
// cannot forge who voted or when.
export async function putVotes(
  uid: string,
  votes: readonly VoteRecord[],
): Promise<VoteRecord[]> {
  const { db, fs } = await loadSdk()
  const sent: VoteRecord[] = []
  for (const vote of votes) {
    try {
      await fs.addDoc(fs.collection(db, 'votes'), {
        v: vote.v,
        a: vote.a,
        b: vote.b,
        choice: vote.choice,
        ms: vote.ms,
        seed: vote.seed,
        source: vote.source,
        at: vote.at,
        by: uid,
        sat: fs.serverTimestamp(),
      })
      sent.push(vote)
    } catch {
      // Keep going. The queue keeps whatever did not land and retries it on the
      // next flush, so a transient failure costs nothing and a permanently
      // rejected row does not block the ones behind it.
    }
  }
  return sent
}

// The same, for rated single views. A separate collection rather than a `votes`
// row with half its fields null: a rating is an observation about one candidate
// and a vote is one about a pair, and merging them would make every query over
// either have to filter the other out.
export async function putRatings(
  uid: string,
  ratings: readonly RatingRecord[],
): Promise<RatingRecord[]> {
  const { db, fs } = await loadSdk()
  const sent: RatingRecord[] = []
  for (const rating of ratings) {
    try {
      await fs.addDoc(fs.collection(db, 'ratings'), {
        v: rating.v,
        tagSet: rating.tagSet,
        look: rating.look,
        query: rating.query,
        weights: rating.weights,
        preset: rating.preset,
        provenance: rating.provenance,
        tags: rating.tags,
        cool: rating.cool,
        ms: rating.ms,
        source: rating.source,
        at: rating.at,
        by: uid,
        sat: fs.serverTimestamp(),
      })
      sent.push(rating)
    } catch {
      // As above: one bad row costs itself and nothing behind it.
    }
  }
  return sent
}
