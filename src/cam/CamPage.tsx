import { useEffect, useRef, useState } from 'react'

import { publicUrl } from '../publicUrl'
import { cx } from '../ui/cx'
import { save } from '../ui/download'
import { FatalScreen } from '../ui/FatalScreen'
import { useCapture } from '../ui/useCapture'
import { useWakeLock } from '../ui/useWakeLock'
import styles from './cam.module.css'
import {
  DiceIcon,
  FlipIcon,
  MicIcon,
  ShareIcon,
  TapeIcon,
  TiltIcon,
} from './icons'
import { aimKey, chromaHue, colourAt, keysOnHue, sourcePoint } from './keyed'
import {
  CAM_LOOKS,
  CAM_MIX_LOOKS,
  lookBoard,
  lookLabel,
  needsSecond,
  rollLook,
} from './looks'
import { useCamEngine } from './useCamEngine'
import { useCamera } from './useCamera'
import { useSecond } from './useSecond'
import { useTilt } from './useTilt'

import type { Look } from './looks'
import type { PointerEvent } from 'react'

type Mode = 'photo' | 'video'

// A press becomes the original after it has been held this long, so a swipe or
// a tap never flashes it.
const HOLD_MS = 180
const SWIPE_PX = 40
const TAP_PX = 10

interface Gesture {
  id: number
  x: number
  y: number
  timer: number
  kind: 'pending' | 'compare' | 'swipe'
}

// The last thing the shutter made, held until the next one replaces it.
interface Shot {
  blob: Blob
  name: string
  url: string
  video: boolean
}

const isAbort = (e: unknown) =>
  e instanceof DOMException && e.name === 'AbortError'

// A phone saves to its photo library through the share sheet; anything without
// one downloads the file.
async function deliver(shot: Shot) {
  const file = new File([shot.blob], shot.name, { type: shot.blob.type })
  if ('canShare' in navigator && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (e) {
      if (!isAbort(e)) save(shot.blob, shot.name)
    }
  } else {
    save(shot.blob, shot.name)
  }
}

function Elapsed(props: { since: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 500)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((now - props.since) / 1000))
  return (
    <span>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  )
}

// The instrument, opened on the look this page is showing and asking for the
// camera again. A look at full strength is a preset the link can name; a
// weaker one is a blend, which only the instrument's own link format carries.
function instrumentHref(look: Look | null, cameraOn: boolean): string {
  const q = new URLSearchParams()
  if (look !== null && look.strength === 1) q.set('preset', look.name)
  if (cameraOn) q.set('src', 'webcam')
  return q.size === 0 ? '../app/' : `../app/?${q}`
}

export function CamPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eng = useCamEngine(canvasRef)
  const cam = useCamera(eng.showVideo)
  const tilt = useTilt(eng.steer)
  const [look, setLook] = useState<Look | null>(null)
  const [tuning, setTuning] = useState(false)
  const [mode, setMode] = useState<Mode>('photo')
  const [comparing, setComparing] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const [error, setError] = useState('')
  const [recSince, setRecSince] = useState(0)
  const second = useSecond(eng, cam, setError)
  const [sound, setSound] = useState(false)
  // Where a tap has aimed the look's hue keyer, while that look is up.
  const [keyHue, setKeyHue] = useState<number | null>(null)
  const [flash, setFlash] = useState('')
  const [ring, setRing] = useState<{
    x: number
    y: number
    rgb: string
  } | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const flashTimer = useRef(0)
  const ringTimer = useRef(0)

  const capture = useCapture(
    canvasRef,
    lookLabel(look),
    setError,
    (blob, name) =>
      setShot({
        blob,
        name,
        url: URL.createObjectURL(blob),
        video: blob.type.startsWith('video/'),
      }),
    { clock: true, audio: () => eng.engine?.audioState.tap() ?? null },
  )

  useEffect(() => {
    if (shot === null) return undefined
    const url = shot.url
    return () => URL.revokeObjectURL(url)
  }, [shot])

  useWakeLock(eng.engine !== null)

  const show = (next: Look | null, hue: number | null) => {
    const board = lookBoard(next)
    eng.showBoard({ ...board, controls: aimKey(board.controls, hue) })
  }
  // A tap's aim lasts while its look stays up, through a change of strength.
  const land = (next: Look | null) => {
    const hue =
      next !== null && look !== null && next.name === look.name ? keyHue : null
    setLook(next)
    setKeyHue(hue)
    show(next, hue)
  }
  // A second press on the look already up opens its strength, the way a photo
  // app's filter does.
  const pick = (name: string) => {
    if (look !== null && look.name === name && !look.rolled) {
      setTuning(!tuning)
      return
    }
    setTuning(false)
    land({ name, strength: 1, rolled: false })
  }
  const pickNormal = () => {
    setTuning(false)
    land(null)
  }
  const roll = () => {
    setTuning(false)
    land(rollLook(look))
  }

  const shutter = () => {
    setError('')
    if (mode === 'photo') {
      capture.grabStill()
    } else {
      if (!capture.recording) setRecSince(performance.now())
      capture.toggleRecord()
    }
  }

  const flipTilt = () => {
    setError('')
    void tilt.toggle().then(ok => {
      if (!ok)
        setError(
          'Motion access was turned down. Allow it in the browser’s site settings and try again.',
        )
    })
  }

  // The other camera goes on screen and the one that was there goes on B, live
  // or as a tape, under a look that mixes the two. The scene behind the phone
  // and the person holding it share the picture.
  const mixIn = () => {
    setError('')
    void second.load().then(got => {
      if (got === null) return
      if (got === 'tape' && cam.canFlip) cam.flip()
      setTuning(false)
      land({ name: CAM_MIX_LOOKS[0], strength: 1, rolled: false })
    })
  }
  const takeOff = () => {
    second.eject()
    if (look !== null && needsSecond(look.name)) {
      setTuning(false)
      land(null)
    }
  }

  const flipSound = () => {
    setError('')
    const next = !sound
    eng.hear(next).then(
      () => setSound(next),
      () =>
        setError(
          'Microphone access was turned down. Allow it in the browser’s site settings and try again.',
        ),
    )
  }

  const announce = (text: string) => {
    setFlash(text)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(''), 900)
  }

  // A swipe steps along the strip, the way a phone camera steps through its
  // filters, with normal at the start.
  const step = (dir: 1 | -1) => {
    const order: (string | null)[] = [null, ...strip]
    const at = look === null || look.rolled ? 0 : order.indexOf(look.name)
    const name = order[(Math.max(at, 0) + dir + order.length) % order.length]
    setTuning(false)
    land(name === null ? null : { name, strength: 1, rolled: false })
    announce(
      name === null
        ? 'normal'
        : lookLabel({ name, strength: 1, rolled: false }),
    )
    document
      .querySelector(`[data-look="${name ?? 'normal'}"]`)
      ?.scrollIntoView({
        inline: 'center',
        block: 'nearest',
        behavior: 'smooth',
      })
  }

  // A tap on a look that keys its loop by hue moves the key to the camera's
  // colour under the finger.
  const tap = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = eng.camera()
    if (c === null || !keysOnHue(lookBoard(look).controls)) return
    const rect = e.currentTarget.getBoundingClientRect()
    const at = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
    const rgb = colourAt(
      c.video,
      sourcePoint(at, rect, {
        width: c.video.videoWidth,
        height: c.video.videoHeight,
        mirror: c.mirror,
      }),
    )
    if (rgb === null) return
    const hue = chromaHue(...rgb)
    if (hue === null) {
      announce('no colour there to key on')
      return
    }
    setKeyHue(hue)
    show(look, hue)
    setRing({
      ...at,
      rgb: `rgb(${rgb.map(v => Math.round(v * 255)).join(' ')})`,
    })
    window.clearTimeout(ringTimer.current)
    ringTimer.current = window.setTimeout(() => setRing(null), 800)
  }

  const press = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const timer = window.setTimeout(() => {
      const g = gesture.current
      if (g !== null && g.kind === 'pending') {
        g.kind = 'compare'
        setComparing(true)
        eng.compare(true)
      }
    }, HOLD_MS)
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      timer,
      kind: 'pending',
    }
  }
  const drag = (e: PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    if (g === null || g.id !== e.pointerId || g.kind !== 'pending') return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      window.clearTimeout(g.timer)
      g.kind = 'swipe'
      step(dx < 0 ? 1 : -1)
    }
  }
  const release =
    (cancelled: boolean) => (e: PointerEvent<HTMLCanvasElement>) => {
      const g = gesture.current
      if (g === null || g.id !== e.pointerId) return
      window.clearTimeout(g.timer)
      gesture.current = null
      if (g.kind === 'compare') {
        setComparing(false)
        eng.compare(false)
      } else if (
        !cancelled &&
        g.kind === 'pending' &&
        Math.hypot(e.clientX - g.x, e.clientY - g.y) < TAP_PX
      ) {
        tap(e)
      }
    }

  if (eng.fatal !== null) return <FatalScreen fatal={eng.fatal} />

  const strength = look === null ? 0 : Math.round(look.strength * 100)
  const strip: readonly string[] = second.loaded
    ? [...CAM_MIX_LOOKS, ...CAM_LOOKS]
    : CAM_LOOKS

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <a className={styles.brand} href="../">
          <img className={styles.mark} src={publicUrl('favicon.svg')} alt="" />
          videoskillet
        </a>
        <a
          className={styles.more}
          href={instrumentHref(look, cam.state === 'on')}
        >
          all controls
        </a>
      </header>

      <main className={styles.stage}>
        <div className={cx(styles.frame, eng.turned && styles.turned)}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            title="hold to see the camera without the look, swipe for another look"
            onPointerDown={press}
            onPointerMove={drag}
            onPointerUp={release(false)}
            onPointerCancel={release(true)}
            onContextMenu={e => e.preventDefault()}
          />
          {cam.state === 'on' ? (
            <div className={cx(styles.switches, styles.left)}>
              {tilt.supported ? (
                <button
                  className={cx(styles.switch, tilt.on && styles.on)}
                  aria-pressed={tilt.on}
                  aria-label="steer the loop by tilting the phone"
                  title="steer the loop by tilting the phone"
                  onClick={flipTilt}
                >
                  <TiltIcon />
                </button>
              ) : null}
              <button
                className={cx(styles.switch, sound && styles.on)}
                aria-pressed={sound}
                aria-label="let the room's sound shake the set"
                title="let the room's sound shake the set"
                onClick={flipSound}
              >
                <MicIcon />
              </button>
            </div>
          ) : null}
          {cam.state === 'on' ? (
            <div className={cx(styles.switches, styles.right)}>
              <button
                className={cx(styles.switch, second.loaded && styles.on)}
                aria-pressed={second.loaded}
                aria-label={
                  second.loaded
                    ? 'take the second picture off B'
                    : 'mix the other camera in'
                }
                title={
                  second.loaded
                    ? 'take the second picture off B'
                    : 'mix the other camera in'
                }
                disabled={
                  second.left > 0 || second.opening || capture.recording
                }
                onClick={second.loaded ? takeOff : mixIn}
              >
                <TapeIcon />
              </button>
            </div>
          ) : null}
          {second.left > 0 ? (
            <span className={cx(styles.badge, styles.rec)}>
              tape {second.left}
            </span>
          ) : second.opening ? (
            <span className={styles.badge}>second camera</span>
          ) : null}
          {comparing ? <span className={styles.badge}>original</span> : null}
          {flash === '' ? null : <span className={styles.flash}>{flash}</span>}
          {ring === null ? null : (
            <span
              className={styles.ring}
              style={{
                left: `${ring.x * 100}%`,
                top: `${ring.y * 100}%`,
                background: ring.rgb,
              }}
            />
          )}
          {capture.recording ? (
            <span className={cx(styles.badge, styles.rec)}>
              <Elapsed since={recSince} />
            </span>
          ) : null}
          {eng.rebuilding ? (
            <p className={styles.notice}>Reconnecting to the GPU…</p>
          ) : eng.frozen ? (
            <p className={styles.notice}>
              The picture stopped updating. Reload the page to bring it back.
            </p>
          ) : cam.state === 'off' ? (
            <button className={styles.start} onClick={cam.start}>
              Start camera
            </button>
          ) : cam.state === 'starting' ? (
            <p className={styles.notice}>Starting the camera…</p>
          ) : cam.state === 'error' ? (
            <div className={styles.notice}>
              <p>{cam.error}</p>
              <button className={styles.start} onClick={cam.start}>
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </main>

      <section className={styles.controls}>
        {error === '' ? null : <p className={styles.error}>{error}</p>}
        {tuning && look !== null ? (
          <label className={styles.tune}>
            <span className={styles.tuneName}>{lookLabel(look)}</span>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={100}
              value={strength}
              onChange={e =>
                land({ ...look, strength: Number(e.target.value) / 100 })
              }
            />
            <span className={styles.tuneValue}>{strength}</span>
          </label>
        ) : null}

        <nav className={styles.strip} aria-label="Looks">
          <button
            className={cx(styles.chip, look?.rolled === true && styles.chipOn)}
            title="a feedback loop picked at random from all of them"
            onClick={roll}
          >
            <DiceIcon />
            {look?.rolled === true ? lookLabel(look) : 'random'}
          </button>
          <button
            className={cx(styles.chip, look === null && styles.chipOn)}
            data-look="normal"
            onClick={pickNormal}
          >
            normal
          </button>
          {strip.map(name => {
            const on = look !== null && !look.rolled && look.name === name
            return (
              <button
                key={name}
                data-look={name}
                className={cx(styles.chip, on && styles.chipOn)}
                aria-pressed={on}
                onClick={() => pick(name)}
              >
                {lookLabel({ name, strength: 1, rolled: false })}
                {on && look.strength < 1 ? (
                  <span className={styles.chipStrength}>{strength}</span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className={styles.row}>
          {shot === null ? (
            <span className={styles.thumbSlot} />
          ) : (
            <button
              className={styles.thumb}
              title={`save or share ${shot.name}`}
              onClick={() => void deliver(shot)}
            >
              {shot.video ? (
                <video
                  src={`${shot.url}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img src={shot.url} alt="" />
              )}
              <span className={styles.thumbShare}>
                <ShareIcon />
              </span>
            </button>
          )}
          <button
            className={cx(
              styles.shutter,
              mode === 'video' && styles.shutterVideo,
              capture.recording && styles.shutterRec,
            )}
            aria-label={
              mode === 'photo'
                ? 'take a photo'
                : capture.recording
                  ? 'stop recording'
                  : 'start recording'
            }
            onClick={shutter}
          />
          {cam.canFlip || second.live ? (
            <button
              className={styles.flip}
              aria-label={
                second.live
                  ? 'swap the two cameras'
                  : cam.facing === 'user'
                    ? 'switch to the back camera'
                    : 'switch to the front camera'
              }
              onClick={second.live ? () => void second.swap() : cam.flip}
            >
              <FlipIcon />
            </button>
          ) : (
            <span className={styles.thumbSlot} />
          )}
        </div>

        <div className={styles.modes} role="radiogroup" aria-label="Shutter">
          {(['photo', 'video'] as const).map(m => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              className={cx(styles.mode, mode === m && styles.modeOn)}
              disabled={capture.recording}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
