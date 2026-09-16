import { useState } from 'react'

import styles from './Account.module.css'
import { warmSignIn } from './cloud'
import { MenuItem, Popover } from './Popover'

import type { CloudUser } from './cloud'
import type { CloudStatus } from './useSavedProfiles'

// Who is signed in, and the two verbs over that: in, and out. Its own control
// beside the library button rather than folded into it, because an account and
// a list of looks are two different facts and one button cannot label both —
// the library button used to relabel itself `sign in`, so answering it landed
// you in a save form you had not asked for.
//
// Signed in it is the photo and nothing else, which is the shape the site bar
// on the home page already takes. Signed out it is the plain ask.
export function Account(props: {
  user: CloudUser | null
  status: CloudStatus
  onSignIn: () => void
  onSignOut: () => void
}) {
  const [broken, setBroken] = useState(false)

  // A session being picked back up is not one being asked to sign in: `sign in`
  // here would flash false for as long as Firebase takes to confirm what the
  // last visit already recorded.
  if (props.user === null) {
    const checking = props.status === 'loading'
    return (
      <button
        className={styles.signIn}
        disabled={checking}
        title={
          checking
            ? 'checking your account…'
            : 'sign in to keep looks under a name on your account — everything else in the app works signed out'
        }
        // The popup has to open inside the browser's allowance for the click
        // that asked for it, and a first sign-in that spent it downloading the
        // SDK got the window blocked. Pointing at the button is reason enough
        // to fetch.
        onPointerEnter={warmSignIn}
        onFocus={warmSignIn}
        onClick={props.onSignIn}
      >
        {checking ? '…' : 'sign in'}
      </button>
    )
  }

  const name = props.user.name ?? props.user.uid.slice(0, 6)
  const photo = props.user.photo
  return (
    <Popover
      trigger={attrs => (
        <button
          className={styles.acctBtn}
          popoverTarget={attrs.popoverTarget}
          style={attrs.style}
          title={`signed in as ${name} — click to sign out`}
          aria-label={name}
        >
          {photo === undefined || photo === null || broken ? (
            <span className={styles.initial} aria-hidden>
              {(name.trim()[0] ?? '?').toUpperCase()}
            </span>
          ) : (
            <img
              className={styles.avatar}
              src={photo}
              alt=""
              // Google serves an avatar only to a request that names no
              // referrer.
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
            />
          )}
        </button>
      )}
    >
      {id => (
        <>
          <div className={styles.who}>{name}</div>
          <MenuItem
            icon="↩"
            label="sign out"
            hint=""
            title="sign out — the library stays on your account, this browser just stops showing it"
            closes={id}
            onClick={props.onSignOut}
          />
        </>
      )}
    </Popover>
  )
}
