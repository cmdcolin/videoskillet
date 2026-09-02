import { useState } from 'react'

import { cx } from './cx'
import { Dialog } from './Dialog'
import dlg from './dialog.module.css'
import ui from './ui.module.css'

// The address of a video file, played straight off whatever server holds it.
//
// The sibling box (YouTubeDialog) takes a *page* and hands it to yt-dlp through
// the dev bridge, which downloads the whole clip first and is why that entry is
// missing from a production build. This one has no bridge behind it: the address
// goes on a <video> element, so it ships, it starts playing off the front of the
// file, and it is the one source a shared link can carry whole rather than by
// identity.
//
// The CORS line is said in the box rather than left to the failure, because the
// failure does not say it: a server that sends the bytes without
// `Access-Control-Allow-Origin` plays the clip perfectly and taints the texture
// upload, so the picture goes black with nothing logged that names the cause.
export function VideoUrlDialog(props: {
  slot: 'a' | 'b'
  url: string
  onSubmit: (url: string) => void
  onClose: () => void
}) {
  const [url, setUrl] = useState(props.url)
  return (
    <Dialog
      title={`Play a video URL in source ${props.slot.toUpperCase()}`}
      size="prose"
      onClose={props.onClose}
    >
      <p className={ui.helpText}>
        Paste the address of a video file — an <code>.mp4</code>,{' '}
        <code>.webm</code> or anything else the browser plays. It is fetched by
        the video element itself and fed through the signal path like a picked
        file, and it travels in the share link, so whoever opens that link lands
        on the same clip.
      </p>
      <form
        className={dlg.cardRow}
        onSubmit={e => {
          e.preventDefault()
          props.onSubmit(url)
        }}
      >
        <input
          className={ui.select}
          type="text"
          placeholder="https://…/clip.mp4"
          value={url}
          onChange={e => setUrl(e.target.value)}
          data-autofocus
        />
        <button className={cx(ui.btn, ui.btnFlush)} type="submit">
          Play
        </button>
      </form>
      <p className={ui.helpText}>
        The server has to allow cross-origin reads. One that serves the file but
        no <code>Access-Control-Allow-Origin</code> header plays it and leaves
        the picture black, since the frames cannot be read back onto the GPU.
      </p>
    </Dialog>
  )
}
