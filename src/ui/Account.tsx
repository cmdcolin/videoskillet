import { useState } from 'react'

import styles from './Account.module.css'
import { warmSignIn } from './cloud'
import { MenuItem, Popover } from './Popover'
import ui from './ui.module.css'

import type { CloudUser } from './cloud'
import type { CloudStatus } from './useSavedProfiles'

// The account control: who is signed in, and the way in and out. It sits beside
// the library button, because a list of looks and an account are two facts and
// one button can label only one of them. The library button used to relabel
// itself `sign in`, so answering it left you looking at a save form you had not
// opened.
//
// Signed in the control shows the account photo, which is the shape the site
// bar on the home page already takes. Signed out it shows the ask.
export function Account(props: {
  user: CloudUser | null
  status: CloudStatus
  onSignIn: () => void
  onSignOut: () => void
}) {
  const [broken, setBroken] = useState(false)

  // `sign in` would flash false for as long as Firebase takes to confirm what
  // the last visit already recorded, so a session still being restored says `…`.
  if (props.user === null) {
    const checking = props.status === 'loading'
    return (
      <button
        className={ui.chromeLabel}
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
