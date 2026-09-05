import { useState } from 'react'

import { cx } from './cx'
import { Dialog } from './Dialog'
import dlg from './dialog.module.css'
import { SNOW_SECONDS } from './snow'
import ui from './ui.module.css'
import { hasSnow, withSnow } from './useUrlState'

// Handing the look to someone else.
//
// Two links for one board, because the address bar and a share are not the same
// errand. The bar carries the named form — `#set=noiseIre:9` — so a look on
// screen can be read off it, edited in place and handed to something scripting
// the app; that form runs four times the characters, which is exactly what you
// do not want in a message. So the short one leads here and the readable one
// sits under it.
//
// A dialog rather than the silent copy a palette press used to do: a link is the
// one thing this app makes that leaves it, and going through a box means seeing
// what is about to be pasted.
export function ShareDialog(props: {
  shareUrl: string
  readableUrl: string
  onCopy: (url: string) => Promise<boolean>
  onClose: () => void
}) {
  // Which row last reached the clipboard, so the tick sits on the button that
  // was pressed rather than on the dialog.
  const [copied, setCopied] = useState<'share' | 'readable' | null>(null)
  // Whether the link kicks its loops off. It starts wherever the session is:
  // arrive on a kicked link and the bar keeps saying so (urlParams.ts), and a
  // link passed on ought to open the way this one did.
  const [snow, setSnow] = useState(hasSnow(props.shareUrl))
  const link = (url: string) => withSnow(url, snow ? SNOW_SECONDS : null)
  const row = (
    kind: 'share' | 'readable',
    label: string,
    blurb: string,
    url: string,
  ) => (
    <>
      <p className={ui.helpText}>
        <strong>{label}</strong> — {blurb}
      </p>
      <div className={dlg.cardRow}>
        <input
          className={ui.select}
          type="text"
          readOnly
          value={url}
          aria-label={`${label} to this look`}
          // Whoever opens this box means to take the link somewhere, so the
          // keyboard route is as short as the button.
          onFocus={e => e.currentTarget.select()}
          {...(kind === 'share' ? { 'data-autofocus': true } : {})}
        />
        <button
          className={cx(ui.btn, ui.btnFlush)}
          onClick={() => {
            void props.onCopy(url).then(ok => {
              setCopied(ok ? kind : null)
            })
          }}
        >
          {copied === kind ? 'copied ✓' : 'copy'}
        </button>
      </div>
    </>
  )
  return (
    <Dialog title="Share this look" size="prose" onClose={props.onClose}>
      {row(
        'share',
        'Short link',
        'the whole board packed into a couple of hundred characters',
        link(props.shareUrl),
      )}
      {row(
        'readable',
        'Readable link',
        'every control it moved, by name — what the address bar is showing, and what to hand something driving the app',
        link(props.readableUrl),
      )}
      {/* The look travels; a running feedback loop does not. Whatever the loops
          have built is in VRAM, and the reader's page comes up with it empty —
          so a board that lives on what it is amplifying opens black and stays
          there, which reads as the link being broken. The burst is what a hand
          across the lens does for a camera pointed at its own monitor. */}
      <label className={dlg.check}>
        <input
          type="checkbox"
          checked={snow}
          onChange={e => {
            setSnow(e.target.checked)
            setCopied(null)
          }}
        />
        start it with a burst of snow — for a look the feedback loops have to
        build, which opens on black without something to amplify
      </label>
      <p className={ui.helpText}>
        Both open the same board. Neither carries a picked file: a source off
        your own disk lives in this browser, so a link naming one lands on bars
        for whoever opens it.
      </p>
    </Dialog>
  )
}
