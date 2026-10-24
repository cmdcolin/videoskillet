import { createCloud } from 'skillet-shared/cloud'
import { FIREBASE_CONFIG } from 'skillet-shared/firebase-config'

import { RECENT_MAX } from './profileModel'
import { readStored, removeStored, writeString } from './storage'

import type { RatingRecord } from '../labels'
import type { CandidateRecord, VoteRecord } from '../vote/votes'
import type { RecentSession, SavedProfile } from './profileModel'

// The Firebase surface: sign-in, the one document a signed-in user keeps their
// saved profiles and last session in, and the stills under it.
// skillet-shared/cloud loads the SDK on first use, and nothing else in the app
// imports `firebase`.
//
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

const cloud = createCloud({
  config: FIREBASE_CONFIG,
  collection: COLLECTION,
  listField: 'profiles',
  signedInHint: SIGNED_IN_HINT,
  appCheckSiteKey: APPCHECK_SITE_KEY,
  recentMax: RECENT_MAX,
  storage: { read: readStored, write: writeString, forget: removeStored },
})

export type { CloudUser } from 'skillet-shared/cloud'
export const { wasSignedIn, warmSignIn, watchAuth, signIn, signOut } = cloud
export const { putSession, dropSession, loadSdk } = cloud

export interface HomeDoc {
  profiles: SavedProfile[]
  recent: RecentSession[]
}

export async function fetchHome(uid: string): Promise<HomeDoc> {
  const { items, recent } = await cloud.fetchHome(uid)
  return { profiles: items, recent }
}

export const editProfiles = cloud.editItems

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

// --- reports of recordings that failed (src/ui/takeLog.ts) ---

// One report, stamped with the server's clock as the rule requires. Swallowed
// on failure: the report describes a take that is already lost, and nothing
// waits on it.
export async function putTakeReport(
  report: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    const { db, fs } = await loadSdk()
    await fs.addDoc(fs.collection(db, 'takeReports'), {
      ...report,
      sat: fs.serverTimestamp(),
    })
  } catch {
    // Offline, or a field the rule refused.
  }
}
