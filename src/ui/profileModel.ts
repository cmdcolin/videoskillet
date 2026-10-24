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

import {
  ITEM_MAX,
  ITEM_NAME_MAX,
  cleanItemName,
  newItemId,
  pushRecent as pushItemRecent,
  readItems,
  readRecent as readItemRecent,
  removeItem,
  renameItem,
  suggestItemName,
  upsertItem,
} from 'skillet-shared/saved-list'

import type {
  RecentSession,
  SavedItem as SavedProfile,
} from 'skillet-shared/saved-list'

// How many sessions one account keeps. The rules refuse a longer list. Kept
// out of the region below: bender caps its own account's history separately.
// A session's query is usually the packed form (tens to a few hundred bytes),
// so 1000 of them sits well under Firestore's 1 MiB document cap even though
// QUERY_MAX would not.
export const RECENT_MAX = 1000

export type {
  CurrentSession,
  RecentSession,
  SavedItem as SavedProfile,
} from 'skillet-shared/saved-list'
export { QUERY_MAX, readCurrent, removeRecent } from 'skillet-shared/saved-list'

export const PROFILE_MAX = ITEM_MAX
export const PROFILE_NAME_MAX = ITEM_NAME_MAX
export const newProfileId = newItemId
export const cleanProfileName = cleanItemName
export const readProfiles = readItems
export const removeProfile = removeItem
export const renameProfile = renameItem
export const upsertProfile = upsertItem

export const suggestProfileName = (
  profiles: Parameters<typeof suggestItemName>[0],
  base: string,
) => suggestItemName(profiles, base, 'my look')

export const readRecent = (raw: unknown, legacy?: unknown) =>
  readItemRecent(raw, RECENT_MAX, legacy)

export const pushRecent = (
  recent: readonly RecentSession[],
  entry: RecentSession,
) => pushItemRecent(recent, entry, RECENT_MAX)

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
