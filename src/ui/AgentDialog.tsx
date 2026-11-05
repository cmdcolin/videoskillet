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
    '- In the videoskillet tab, window.vf.applyControls({...}) sets controls and window.vf.getControls() reads them back.',
    '- window.vfBoard.apply(link) lands a whole board (sources, controls, motion) in one undoable step, and window.vfBoard.read() returns it as text.',
    '- window.vfBoard.demos() lists the gallery demos with a link each to pass to apply.',
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
        An AI agent such as Claude Code can play this app while it runs. The
        route it takes depends on what the agent can reach.
      </p>

      <h3 className={styles.route}>Claude Code, driving this tab</h3>
      <p className={styles.body}>
        Run <code>claude --chrome</code> and ask for a look in plain words.
        Claude Code works in this tab and calls the engine directly:
      </p>
      <pre className={styles.code}>
        {`window.vf.applyControls({ bKey: 1, bKeyHueDeg: 241 })
window.vf.getControls()
window.vfBoard.apply('#preset=vhs&set=noiseIre:9')
window.vfBoard.read()`}
      </pre>
      <p className={styles.body}>
        Keep the tab in front, because a hidden tab stops drawing frames. A
        coding agent can also open its own browser with Playwright and call the
        same methods.
      </p>

      <h3 className={styles.route}>Any browsing agent</h3>
      <p className={styles.body}>
        Claude in Chrome and other browsing agents use the command palette.
        Ctrl+K opens it, and it sets a control from its name and a value in one
        line, such as <code>head switch 9</code>. The <b>board as text</b>{' '}
        section lists every control that is off stock, with its key, and a link
        or board pasted into the box under it is applied in one step.
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
