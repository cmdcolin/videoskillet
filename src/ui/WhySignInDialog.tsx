import { useState } from 'react'

import { publicUrl } from '../publicUrl'
import { Dialog } from './Dialog'
import { PRIVACY_URL } from './links'
import ui from './ui.module.css'
import { FREE_WITHOUT, PITCH, SHOT_ALT, SHOT_SIZE } from './whySignIn'
import styles from './WhySignInDialog.module.css'

// Why an account, and the two ways on from the question: sign in, or copy the
// look as a link and keep it that way. The ⋮ menu opens the card, the saved
// menu opens it, and so does a save pressed with nobody signed in — the press
// that leaves a look waiting on an answer.
export function WhySignInDialog(props: {
  onClose: () => void
  onSignIn: () => void
  /** Resolves false when the clipboard refused, so the ✓ means it landed. */
  onCopyLink: () => Promise<boolean>
  /** The name a waiting save will land under, or null when none is waiting. */
  pendingName: string | null
}) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void props.onCopyLink().then(ok => {
      if (!ok) return
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }
  return (
    <Dialog title="why sign in?" size="prose" onClose={props.onClose}>
      {/* Names the look the waiting save will write, so the sentence points at
          something the reader recognises. */}
      {props.pendingName === null ? null : (
        <p className={styles.pending}>
          Signing in saves the look on screen as{' '}
          <b className={styles.pendingName}>{props.pendingName}</b>.
        </p>
      )}
      <p className={styles.pitch}>{PITCH}</p>
      {/* The home an account gets, drawn from a fixture by
          `scripts/homeshot.mjs`. The card is only mounted while it is open, so
          the picture is fetched by the reader who asked the question. */}
      <img
        className={styles.shot}
        src={publicUrl('home-signed-in.webp')}
        alt={SHOT_ALT}
        width={SHOT_SIZE.width}
        height={SHOT_SIZE.height}
      />
      <p className={ui.hint}>
        {FREE_WITHOUT}{' '}
        {/* A new tab, like every link on the about card. Navigating away from
            the app tears down the engine and the sources with it. */}
        <a
          className={ui.link}
          href={PRIVACY_URL}
          target="_blank"
          rel="noreferrer"
        >
          what an account stores ↗
        </a>
      </p>
      <div className={styles.row}>
        <button className={styles.go} onClick={props.onSignIn}>
          sign in with Google
        </button>
        {/* The other way to keep a look, for anyone who would rather not have
            an account: every look is already a link. */}
        <button className={styles.alt} onClick={copy}>
          {copied ? 'link copied ✓' : 'copy this look as a link'}
        </button>
      </div>
    </Dialog>
  )
}
