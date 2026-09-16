// Saved profiles: the whole board under a name, the way a synth saves a voice —
// dial something in, name it, get it back later. Distinct from midi.ts's
// DeviceProfile, which describes a controller's CC layout and nothing else; the
// `Saved` prefix is there to keep the two apart at a glance.
//
// The stored form is a query string — the same one the address bar carries, from
// the same writer (writeProfileParams). That is deliberate, and it is the one
// decision here worth defending:
//
//   - It is already the app's serialization of a session, tested, and read back
//     by a parser that drops anything it no longer recognises. A profile that
//     outlives a renamed control loses that knob rather than failing to load —
//     the property that matters most for something meant to be kept.
//   - It makes a profile shareable for free: prefix the origin and it is a link,
//     so "send someone this look" needs no second format.
//
// The alternative — storing resolved controls, the way Scenes did — would need its
// own migration story for every field that is not a control (motion, the vapor
// speeds, which source), and would still have to grow a serializer the day
// somebody wanted to send one to a friend.
//
// This used to be half a story: nine numbered localStorage slots called Scenes
// held the same thing under a number, for a live set where recall has to be one
// keystroke. They held strictly less than a profile does — controls and motion,
// where the query below carries the source addresses too — so the only thing
// they really owned was the gesture. The 1–9 keys now recall the first nine
// profiles instead (see `profileAtSlot`) and Scenes are gone: one library,
// named, unbounded, shareable, and **kept in the signed-in user's Firestore
// document, not on this device** — a saved profile is meant to be there on the
// next machine, which a localStorage copy could never promise. Everything in
// this file is the storage-agnostic half — the list algebra and the name rules;
// cloud.ts is what reads and writes it.
// CROSS_REPO_SYNC(saved-list-model)
export interface SavedProfile {
  name: string
  query: string
  // What the home page reads a profile by. Optional because a profile written
  // before these existed carries none; the next save fills them in. `id` keys
  // the still in `users/{uid}/stills/{id}` and never changes once minted.
  id?: string
  savedAt?: number
}

// The session a signed-in user last had open, written by the app as the address
// bar changes and read by the home page's resume card. The query is the same
// packed string a profile holds.
export interface CurrentSession {
  query: string
  at: number
}

// How many profiles one account has. The rules refuse a longer list.
export const PROFILE_MAX = 200

// The longest query the rules accept, which a packed board never approaches.
export const QUERY_MAX = 8000

// The longest name a row will hold before the popover starts wrapping. Trimmed
// rather than refused: a paste of a whole sentence should become a name, not an
// error message.
export const PROFILE_NAME_MAX = 40

export const newProfileId = (): string =>
  Math.random().toString(36).slice(2, 10)

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

// Collapse the whitespace a paste brings with it, and cap the length. An empty
// result means "no name given", which the caller declines to save.
export const cleanProfileName = (raw: string): string =>
  raw.replaceAll(/\s+/g, ' ').trim().slice(0, PROFILE_NAME_MAX).trim()

// One stored entry, or undefined when it is not one. Both fields have to be
// strings: the name is rendered and the query is handed to URLSearchParams, and
// a stale-schema value of some other shape would throw at whichever came first.
function readProfile(raw: unknown): SavedProfile | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const name = 'name' in raw ? raw.name : undefined
  const query = 'query' in raw ? raw.query : undefined
  if (typeof name !== 'string' || typeof query !== 'string') return undefined
  if (query.length > QUERY_MAX) return undefined
  const clean = cleanProfileName(name)
  if (clean === '') return undefined
  const id = 'id' in raw && typeof raw.id === 'string' ? raw.id : undefined
  const savedAt = 'savedAt' in raw ? num(raw.savedAt) : undefined
  return {
    name: clean,
    query,
    ...(id === undefined ? {} : { id }),
    ...(savedAt === undefined ? {} : { savedAt }),
  }
}

export const readProfiles = (raw: unknown): SavedProfile[] =>
  (Array.isArray(raw) ? raw : [])
    .flatMap(item => {
      const profile = readProfile(item)
      return profile === undefined ? [] : [profile]
    })
    .slice(0, PROFILE_MAX)

export function readCurrent(raw: unknown): CurrentSession | null {
  if (typeof raw !== 'object' || raw === null) return null
  const query = 'query' in raw ? raw.query : undefined
  const at = 'at' in raw ? num(raw.at) : undefined
  if (typeof query !== 'string' || query.length > QUERY_MAX) return null
  return at === undefined ? null : { query, at }
}

// Save under a name, replacing any profile already using it **in place**. Order
// is insertion order and a re-save does not disturb it: the list is read by eye
// during a set, and a save that reshuffled everything above it would cost the
// one thing a library is for. A list already at the cap drops its oldest entry.
//
// `at` stamps the save and mints an id for a profile that has none; an
// overwrite keeps the id it already had. Without `at` the entry carries no
// metadata, which is what a caller with no clock wants.
export function upsertProfile(
  profiles: readonly SavedProfile[],
  name: string,
  query: string,
  at?: number,
): SavedProfile[] {
  const clean = cleanProfileName(name)
  if (clean === '') return [...profiles]
  const index = profiles.findIndex(item => item.name === clean)
  const prior = index === -1 ? undefined : profiles[index]
  const entry: SavedProfile = { name: clean, query }
  if (prior?.id !== undefined) entry.id = prior.id
  if (at !== undefined) {
    entry.id ??= newProfileId()
    entry.savedAt = at
  }
  if (index !== -1)
    return profiles.map((item, i) => (i === index ? entry : item))
  return [...profiles, entry].slice(-PROFILE_MAX)
}

export const removeProfile = (
  profiles: readonly SavedProfile[],
  name: string,
): SavedProfile[] => profiles.filter(item => item.name !== name)

// Rename in place: the entry keeps its position, its id and its stamps. A name
// another entry already uses leaves the list as it was, so a rename can never
// overwrite anything; the caller tells the two outcomes apart by whether `from`
// is still in the list.
export function renameProfile(
  profiles: readonly SavedProfile[],
  from: string,
  to: string,
): SavedProfile[] {
  const clean = cleanProfileName(to)
  if (clean === '' || profiles.some(item => item.name === clean))
    return [...profiles]
  return profiles.map(item =>
    item.name === from ? { ...item, name: clean } : item,
  )
}

// What the name box offers, so saving is type-nothing-and-press-save. `base` is
// whatever the board is already called — the active preset, or the last one
// edited — and the counter only appears once that name is taken, so the first
// save off a preset is just its name.
export function suggestProfileName(
  profiles: readonly SavedProfile[],
  base: string,
): string {
  const clean = cleanProfileName(base)
  const stem = clean === '' ? 'my look' : clean
  if (!profiles.some(item => item.name === stem)) return stem
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem} ${n}`
    if (!profiles.some(item => item.name === candidate)) return candidate
  }
  return stem
}
// CROSS_REPO_SYNC_END(saved-list-model)

// How many profiles the number keys reach. The digits are the whole reason for
// the bound: there is no key for a tenth.
export const PROFILE_SLOTS = 9

// The profile on key `n` (1-based), or undefined when the library is shorter.
// Position in the list *is* the binding — there is no stored slot number — so a
// delete shifts everything below it up a key. That is accepted rather than
// designed around: `upsertProfile` keeps insertion order and re-saves in place,
// so the only thing that ever moves a binding is a delete, which is not a
// mid-set gesture. The alternative was a per-row "assign to key" control, which
// is more surface than the keys save.
export const profileAtSlot = (
  profiles: readonly SavedProfile[],
  n: number,
): SavedProfile | undefined =>
  n >= 1 && n <= PROFILE_SLOTS ? profiles[n - 1] : undefined
