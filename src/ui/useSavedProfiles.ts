import { useEffect, useRef, useState } from 'react'

import {
  STILL_MAX,
  deleteStill,
  editProfiles,
  fetchHome,
  putStill,
  signIn as cloudSignIn,
  signOut as cloudSignOut,
  wasSignedIn,
  watchAuth,
} from './cloud'
import {
  QUERY_MAX,
  removeProfile,
  suggestProfileName,
  upsertProfile,
} from './profileModel'

import type { CloudUser } from './cloud'
import type { SavedProfile } from './profileModel'

// The profile library: who is signed in, what they have saved, and the verbs over
// it. Firestore is the only store — nothing is written to this device — so
// **signed out there is nothing to save into**, and that shapes the whole hook.
// `user === null` is not a degraded mode with a local fallback behind it; it is
// the state where saving does not exist yet, and the menu says so rather than
// taking a save that would go nowhere.
//
// What that buys: a profile named on the laptop is on the phone, and clearing
// site data no longer loses the library. What it costs: no saving offline, and
// none at all without an account. Recall, presets and the URL are all
// untouched by it — a session that never signs in is the app exactly as it was.
//
// Nothing is fetched until it is needed. `wasSignedIn()` is a localStorage hint,
// so a browser that has never signed in subscribes to nothing and downloads none
// of the SDK, while one that has picks its session back up on load.
export type CloudStatus =
  // No session, nothing loaded: the ordinary first visit.
  | 'signed-out'
  // Restoring a session, signing in, or fetching the list. The menu shows neither
  // the sign-in button nor an empty library while this is true — both would be a
  // lie that flickers.
  | 'loading'
  | 'ready'
  // Sign-in refused, or the network is gone. Kept apart from signed-out so the
  // menu can say what happened instead of silently offering the button again.
  | 'error'

// What the button in the look bar says for a moment after a save was attempted.
// One value rather than three flags, because the three states are exclusive and
// as separate booleans they could contradict each other on screen — a ✓ on a
// button already amber for a save with nowhere to go is one claiming a save
// both did and did not happen.
//
// All three exist for the same reason: two of the three ways to save (ctrl+S and
// the ⌘K row) happen with the menu shut, so the button is the only surface that
// can answer. `failed` is the one that was missing, and it was the likeliest of
// the three — a rejected write, or no network — reported only inside a popover
// nobody had open.
export type ProfileFlash =
  | { kind: 'saved'; name: string }
  | { kind: 'needs-auth' }
  | { kind: 'failed' }

// What came of asking to save. On `needs-auth` the hook has kept the look, and
// the caller opens the why-sign-in card. On `too-long` the hook sets `error`.
export type SaveOutcome = 'saving' | 'needs-auth' | 'too-long'

const errorCode = (e: unknown): unknown =>
  typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined

const saveError = (e: unknown): string => {
  switch (errorCode(e)) {
    case 'unavailable':
    case 'deadline-exceeded':
      return 'could not save — check your connection'
    case 'permission-denied':
    case 'unauthenticated':
      return 'could not save — sign-in expired, sign out and back in'
    case 'invalid-argument':
      return 'could not save — Firestore rejected the saved list'
    case 'resource-exhausted':
      return 'could not save — too many saves, try again in a minute'
    default:
      return 'could not save — try again'
  }
}

/** A save waiting on a sign-in: the look and its still as they were when the
    key was pressed. */
interface PendingSave {
  name: string
  query: string
  still: Promise<string | null> | undefined
}

// The picture the home page's card shows, taken when the save was pressed and
// written after the entry it belongs to has landed. Best effort throughout: a
// profile with no still is a card with a placeholder, and a save that reported
// success must not then report a failure because the encoder declined.
function saveStill(
  uid: string,
  id: string | undefined,
  still: Promise<string | null> | undefined,
) {
  if (id === undefined || still === undefined) return
  still
    .then(webp => (webp === null ? undefined : putStill(uid, id, webp)))
    .catch((e: unknown) => {
      console.error('saving the profile still failed', e)
    })
}

// `grabThumb` is how a save gets a picture: a function so this hook holds no
// canvas of its own. It resolves to null when no still fits under `max`.
// Optional, because the callers that have no output to grab (a test, a future
// panel) still want the library.
export function useSavedProfiles(
  grabThumb?: (max: number) => Promise<string | null>,
) {
  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [user, setUser] = useState<CloudUser | null>(null)
  const [status, setStatus] = useState<CloudStatus>(() =>
    wasSignedIn() ? 'loading' : 'signed-out',
  )
  const [error, setError] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)
  const [flash, setFlash] = useState<ProfileFlash | null>(null)

  // A save pressed with nobody signed in, kept until the library it belongs in
  // has been fetched. Press save, sign in, and the look is saved, so keeping a
  // look costs one gesture and a popup.
  //
  // A ref, because the auth subscription's callback closes over the render that
  // installed it and has to read a press made since.
  const pending = useRef<PendingSave | null>(null)

  // The uid signed in now. A fetch or write that resolves after sign-out, or
  // after a different account signs in, checks it and leaves the state alone.
  const uid = useRef<string | null>(null)

  // Bumped by every save and recall. A save that lands names the profile you
  // are in only if nothing was saved or recalled after it was pressed.
  const named = useRef(0)

  // Bumped by every sign-in press. Firebase rejects a popup when a second one
  // opens, so signIn handles a failure from the latest press only.
  const attempt = useRef(0)

  // Show one for a beat, then take it down — but only if it is still the one this
  // call put up, compared by identity so a second save during the first flash
  // does not have its own answer cut short by the first timer. A failure holds
  // longer than a success: a ✓ confirms something you just asked for, while a ✕
  // has to survive being glanced at late.
  const showFlash = (next: ProfileFlash) => {
    setFlash(next)
    setTimeout(
      () => setFlash(cur => (cur === next ? null : cur)),
      next.kind === 'saved' ? 1600 : 2600,
    )
  }
  // Whether this session wants an auth subscription at all. It starts as "has
  // this browser signed in before", which is what keeps the SDK off an ordinary
  // visit — and a press on sign-in flips it, because the *first* sign-in of a
  // browser happens with no subscription installed. Without that flip the popup
  // would close on a successful sign-in and nothing would ever hear about it:
  // status would sit on `loading` forever, which is exactly how it behaved before
  // this line existed.
  const [wantAuth, setWantAuth] = useState(wasSignedIn)

  // Signing in, signing out and the restore-on-load all arrive here from the
  // subscription, so there is one path that fetches the list rather than one per
  // way in. Declared before the effect that installs it.
  const applyUser = (next: CloudUser | null) => {
    uid.current = next?.uid ?? null
    setUser(next)
    if (next === null) {
      // Signing out clears the rows as well as the session: leaving them up would
      // offer recall and overwrite against a document nobody may write any more.
      setProfiles([])
      setLastName(null)
      setStatus('signed-out')
      return
    }
    setStatus('loading')
    fetchHome(next.uid)
      .then(home => {
        if (uid.current !== next.uid) return
        setProfiles(home.profiles)
        setStatus('ready')
        setError(null)
        landPending(next.uid)
      })
      .catch((e: unknown) => {
        console.error('loading saved profiles failed', e)
        if (uid.current !== next.uid) return
        setStatus('error')
        setError('could not load your saved profiles')
      })
  }

  // Writes the save pressed before sign-in. The name was suggested against an
  // empty list, so suggestProfileName runs again over the stored list: a save
  // named "my rig" then lands as "my rig 2" beside an existing "my rig".
  const landPending = (owner: string) => {
    const want = pending.current
    pending.current = null
    if (want === null) return
    const at = Date.now()
    let name = want.name
    commit(
      owner,
      list => {
        name = suggestProfileName(list, want.name)
        return upsertProfile(list, name, want.query, at)
      },
      () => name,
      want.still,
    )
  }

  // One subscription, and only for a browser that has signed in before — which is
  // what makes the SDK free for everyone else. Firebase resolves the unsubscribe
  // asynchronously, so teardown has to cover both the window before it exists and
  // the call after.
  useEffect(() => {
    if (!wantAuth) return undefined
    let cancelled = false
    let stop: (() => void) | undefined
    watchAuth(next => {
      if (!cancelled) applyUser(next)
    })
      .then(unsub => {
        stop = unsub
        if (cancelled) unsub()
      })
      .catch((e: unknown) => {
        console.error('auth subscribe failed', e)
        if (!cancelled) {
          // A later sign-in press subscribes again.
          setWantAuth(false)
          setStatus('error')
          setError('could not reach the sign-in service')
        }
      })
    return () => {
      cancelled = true
      stop?.()
    }
    // Only on the transition into wanting auth: the callback reads setters, which
    // React keeps stable, so nothing else here needs to re-subscribe.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAuth])

  // The list updates after Firestore accepts the write, so a row on screen is a
  // saved row. Each write sends an edit, and editProfiles applies it to the
  // stored list: two saves in quick succession both land.
  const commit = (
    owner: string,
    edit: (list: SavedProfile[]) => SavedProfile[],
    landed?: () => string,
    still?: Promise<string | null>,
  ) => {
    const mine = landed === undefined ? named.current : ++named.current
    editProfiles(owner, edit)
      .then(next => {
        if (uid.current !== owner) return
        setProfiles(next)
        setError(null)
        if (landed !== undefined) {
          const name = landed()
          if (named.current === mine) setLastName(name)
          showFlash({ kind: 'saved', name })
          saveStill(owner, next.find(p => p.name === name)?.id, still)
        }
      })
      .catch((e: unknown) => {
        console.error('saving profiles failed', e)
        if (uid.current !== owner) return
        setError(saveError(e))
        // The half that was missing: the message above lands inside the popover,
        // and a ctrl+S is made with the popover shut. Without this the write went
        // to the network, failed, and the app looked exactly as it does after a
        // save that worked.
        showFlash({ kind: 'failed' })
      })
  }

  const write = (
    edit: (list: SavedProfile[]) => SavedProfile[],
    landed?: () => string,
    still?: Promise<string | null>,
  ) => {
    if (user !== null) commit(user.uid, edit, landed, still)
  }

  return {
    profiles,
    user,
    status,
    error,
    lastName,
    flash,
    // Signed out this is not merely inert but unreachable: the menu offers the
    // sign-in button in place of the name box, and ctrl+S says so on the button.
    canSave: status === 'ready',
    saveProfile: (name: string, query: string): SaveOutcome => {
      if (query.length > QUERY_MAX) {
        setError(
          `could not save — this look is ${query.length} characters long, and the limit is ${QUERY_MAX}`,
        )
        showFlash({ kind: 'failed' })
        return 'too-long'
      }
      const still = grabThumb?.(STILL_MAX)
      if (status !== 'ready') {
        pending.current = { name, query, still }
        if (user === null) {
          showFlash({ kind: 'needs-auth' })
          return 'needs-auth'
        }
        // Signed in with the list still loading, or with a failed load: the
        // save lands when the list arrives, and a failed load is retried.
        if (status === 'error') applyUser(user)
        return 'saving'
      }
      const at = Date.now()
      write(
        list => upsertProfile(list, name, query, at),
        () => name,
        still,
      )
      return 'saving'
    },
    deleteProfile: (name: string) => {
      const id = profiles.find(p => p.name === name)?.id
      write(list => removeProfile(list, name))
      if (user !== null && id !== undefined) {
        deleteStill(user.uid, id).catch((e: unknown) => {
          console.error('deleting the profile still failed', e)
        })
      }
      // Deleting the profile you were in frees its name again: the next save
      // should offer "my rig", not "my rig 2" against a row that is gone.
      setLastName(cur => (cur === name ? null : cur))
    },
    // A recall makes that profile the one you are in, so the next save offers its
    // name (with a counter) rather than falling back to whichever preset the
    // controls happen to still match. It writes nothing: the 1–9 keys recall
    // mid-set, and a transaction per key press paid for a field nothing read.
    markRecalled: (name: string) => {
      named.current++
      setLastName(name)
    },
    /** Forgets a save held for a sign-in that is no longer coming. */
    dropPending: () => {
      pending.current = null
    },
    signIn: () => {
      setError(null)
      // Signed in with a list that failed to load. Firebase reports no change
      // for a popup that signs the same account in, so fetch again directly.
      if (user !== null) {
        applyUser(user)
        return
      }
      setStatus('loading')
      // Installs the subscription if this is the browser's first sign-in; already
      // true for one that is picking a session back up.
      setWantAuth(true)
      const mine = ++attempt.current
      cloudSignIn().catch((e: unknown) => {
        if (attempt.current !== mine || uid.current !== null) return
        // A popup the user dismissed is not a failure worth a message: they
        // changed their mind, and the button they came from is the right thing to
        // be looking at again.
        const code = errorCode(e)
        if (
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request'
        ) {
          pending.current = null
          setStatus('signed-out')
        } else {
          console.error('sign-in failed', e)
          setStatus('error')
          setError(
            code === 'auth/popup-blocked'
              ? 'the browser blocked the sign-in window — allow pop-ups for this site and try again'
              : 'sign-in failed — try again',
          )
        }
      })
    },
    signOut: () => {
      pending.current = null
      cloudSignOut().catch((e: unknown) => {
        console.error('sign-out failed', e)
      })
    },
  }
}
