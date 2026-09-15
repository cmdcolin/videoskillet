import { useEffect, useRef, useState } from 'react'

import {
  STILL_MAX,
  deleteStill,
  fetchHome,
  putProfiles,
  putStill,
  signIn as cloudSignIn,
  signOut as cloudSignOut,
  wasSignedIn,
  watchAuth,
} from './cloud'
import {
  markOpened,
  removeProfile,
  suggestProfileName,
  upsertProfile,
} from './profileModel'

import type { CloudUser } from './cloud'
import type { CurrentSession, SavedProfile } from './profileModel'

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
// as separate booleans they could contradict each other on screen — a ✓ next to
// an amber `sign in` is a button claiming a save both did and did not happen.
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
// the caller opens the why-sign-in card.
export type SaveOutcome = 'saving' | 'needs-auth'

/** A save waiting on a sign-in: the look as it was when the key was pressed. */
interface PendingSave {
  name: string
  query: string
}

// `grabThumb` is how a save gets a picture: a function so this hook holds no
// canvas of its own. Optional, because the callers that have no output to grab
// (a test, a future panel) still want the library.
export function useSavedProfiles(grabThumb?: () => Promise<string | null>) {
  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [current, setCurrent] = useState<CurrentSession | null>(null)
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
    setUser(next)
    if (next === null) {
      // Signing out clears the rows as well as the session: leaving them up would
      // offer recall and overwrite against a document nobody may write any more.
      setProfiles([])
      setCurrent(null)
      setLastName(null)
      setStatus('signed-out')
      return
    }
    setStatus('loading')
    fetchHome(next.uid)
      .then(home => {
        setProfiles(home.profiles)
        setCurrent(home.current)
        setStatus('ready')
        setError(null)
        landPending(next.uid, home.profiles)
      })
      .catch((e: unknown) => {
        console.error('loading saved profiles failed', e)
        setStatus('error')
        setError('could not load your saved profiles')
      })
  }

  // The save somebody pressed on the way in, written now that there is an
  // account to write it to. suggestProfileName runs again over the library that
  // just arrived, because the first run had an empty one to work from: without
  // the second one, a save named "my rig" would overwrite the "my rig" the
  // account already held.
  const landPending = (uid: string, saved: readonly SavedProfile[]) => {
    const want = pending.current
    pending.current = null
    if (want === null) return
    const name = suggestProfileName(saved, want.name)
    commit(uid, upsertProfile(saved, name, want.query, Date.now()), name)
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

  // The picture the home page's card shows, written after the entry it belongs
  // to has landed. Best effort throughout: a profile with no still is a card
  // with a placeholder, and a save that reported success must not then report a
  // failure because the encoder declined.
  const saveStill = (uid: string, next: SavedProfile[], name: string) => {
    const id = next.find(p => p.name === name)?.id
    if (id === undefined || grabThumb === undefined) return
    grabThumb()
      .then(webp => {
        // Over the cap the document would be refused anyway, and a still is
        // worth less than the save it hangs off.
        if (webp === null || webp.length > STILL_MAX) return undefined
        return putStill(uid, id, webp)
      })
      .catch((e: unknown) => {
        console.error('saving the profile still failed', e)
      })
  }

  // Every write is cloud-only, and the list moves when the document has been
  // accepted rather than before. An optimistic row is a row that looks saved and
  // is not — the one thing a save must never show.
  const commit = (uid: string, next: SavedProfile[], landed?: string) => {
    putProfiles(uid, next)
      .then(() => {
        setProfiles(next)
        setError(null)
        if (landed !== undefined) {
          setLastName(landed)
          showFlash({ kind: 'saved', name: landed })
          saveStill(uid, next, landed)
        }
      })
      .catch((e: unknown) => {
        console.error('saving profiles failed', e)
        setError('could not save — check your connection')
        // The half that was missing: the message above lands inside the popover,
        // and a ctrl+S is made with the popover shut. Without this the write went
        // to the network, failed, and the app looked exactly as it does after a
        // save that worked.
        showFlash({ kind: 'failed' })
      })
  }

  const write = (next: SavedProfile[], landed?: string) => {
    if (user !== null) commit(user.uid, next, landed)
  }

  return {
    profiles,
    // The session this account last had open, read with the profiles. Nothing in
    // the app shows it yet; the home page is what it is there for.
    current,
    user,
    status,
    error,
    lastName,
    flash,
    // Signed out this is not merely inert but unreachable: the menu offers the
    // sign-in button in place of the name box, and ctrl+S says so on the button.
    canSave: status === 'ready',
    saveProfile: (name: string, query: string): SaveOutcome => {
      if (status !== 'ready') {
        pending.current = { name, query }
        showFlash({ kind: 'needs-auth' })
        return 'needs-auth'
      }
      write(upsertProfile(profiles, name, query, Date.now()), name)
      return 'saving'
    },
    deleteProfile: (name: string) => {
      const id = profiles.find(p => p.name === name)?.id
      write(removeProfile(profiles, name))
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
    // controls happen to still match. It also stamps `openedAt`, which is what
    // the home page sorts by — one document write per recall, through the same
    // path a save takes and with no flash, since nobody asked for a save.
    markRecalled: (name: string) => {
      setLastName(name)
      write(markOpened(profiles, name, Date.now()))
    },
    signIn: () => {
      setStatus('loading')
      setError(null)
      // Installs the subscription if this is the browser's first sign-in; already
      // true for one that is picking a session back up.
      setWantAuth(true)
      cloudSignIn().catch((e: unknown) => {
        // A popup the user dismissed is not a failure worth a message: they
        // changed their mind, and the button they came from is the right thing to
        // be looking at again.
        const code =
          typeof e === 'object' && e !== null && 'code' in e ? e.code : ''
        if (
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request'
        ) {
          pending.current = null
          setStatus('signed-out')
        } else {
          console.error('sign-in failed', e)
          setStatus('error')
          setError('sign-in failed — try again')
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
