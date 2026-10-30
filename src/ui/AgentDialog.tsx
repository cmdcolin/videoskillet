import styles from './AgentDialog.module.css'
import { Dialog } from './Dialog'
import { AI_GUIDE_URL, URL_API_URL } from './links'
import { useFlash } from './useFlash'

const agentPrompt = (look: string) =>
  [
    'Drive videoskillet, a real-time NTSC signal-path simulator, starting from this look:',
    look,
    '',
    `- Every control key, its range, and the link parameters: ${URL_API_URL}`,
    `- How an agent drives the app: ${AI_GUIDE_URL}`,
    '- From a browser harness, window.vf.applyControls({...}) sets controls and window.vf.getControls() reads them back.',
  ].join('\n')

export function AgentDialog(props: { onClose: () => void }) {
  const { shown: copied, flash: flashCopied } = useFlash<boolean>(1600)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(agentPrompt(location.href))
      flashCopied(true)
    } catch {
      flashCopied(false)
    }
  }
  return (
    <Dialog title="connect an AI agent" size="prose" onClose={props.onClose}>
      <p className={styles.lead}>
        An AI agent can play this app. The route it takes depends on what the
        agent can reach.
      </p>

      <h3 className={styles.route}>An agent in a browser</h3>
      <p className={styles.body}>
        Claude in Chrome and other browsing agents work in this tab. Ctrl+K
        opens the command palette, which sets a control from its name and a
        value in one line, such as <code>head switch 9</code>. The{' '}
        <b>board as text</b> section lists every control that is off stock, with
        its key.
      </p>

      <h3 className={styles.route}>A coding agent with a shell</h3>
      <p className={styles.body}>
        Claude Code and similar agents launch a browser with Puppeteer or
        Playwright, open this page, and call the engine from it:
      </p>
      <pre className={styles.code}>
        {`window.vf.applyControls({ bKey: 1, bKeyHueDeg: 241 })
window.vf.getControls()`}
      </pre>
      <p className={styles.body}>
        A link sets the sources: <code>?src=webcam&amp;vurlb=…</code> puts the
        camera on A and a video file on B. Keep the window visible, because a
        minimized window stops drawing frames.
      </p>

      <h3 className={styles.route}>An agent that reads links</h3>
      <p className={styles.body}>
        Every look is a link. <code>#set=key:value,…</code> sets controls by
        key, and llms.txt lists every key with its range.
      </p>

      <div className={styles.row}>
        <button className={styles.go} onClick={() => void copy()}>
          {copied === true
            ? 'prompt copied ✓'
            : copied === false
              ? 'the clipboard refused'
              : 'copy a prompt for your agent'}
        </button>
        <a
          className={styles.alt}
          href={URL_API_URL}
          target="_blank"
          rel="noreferrer"
        >
          llms.txt ↗
        </a>
        <a
          className={styles.alt}
          href={AI_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
        >
          AI guide ↗
        </a>
      </div>
    </Dialog>
  )
}
