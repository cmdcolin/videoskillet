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
import {
  CAM_LOOKS,
  CAM_MIX_LOOKS,
  lookBoard,
  lookLabel,
  needsTape,
  rollLook,
} from './looks'
import { useCamEngine } from './useCamEngine'
import { useCamera } from './useCamera'
import { useTape } from './useTape'
import { useTilt } from './useTilt'

import type { Look } from './looks'
import type { PointerEvent } from 'react'

type Mode = 'photo' | 'video'

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
  const tape = useTape(eng, setError)
  const [sound, setSound] = useState(false)

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
    { clock: true },
  )

  useEffect(() => {
    if (shot === null) return undefined
    const url = shot.url
    return () => URL.revokeObjectURL(url)
  }, [shot])

  useWakeLock(eng.engine !== null)

  const land = (next: Look | null) => {
    setLook(next)
    eng.showBoard(lookBoard(next))
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

  // A tape of the camera goes on B, and the page turns to the other camera and
  // a look that mixes the two, so the scene behind the phone and the person
  // holding it share the picture.
  const recordTape = () => {
    setError('')
    void tape.record().then(ok => {
      if (!ok) return
      if (cam.canFlip) cam.flip()
      setTuning(false)
      land({ name: CAM_MIX_LOOKS[0], strength: 1, rolled: false })
    })
  }
  const ejectTape = () => {
    tape.eject()
    if (look !== null && needsTape(look.name)) {
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

  const hold = (on: boolean) => (e: PointerEvent<HTMLCanvasElement>) => {
    if (on) e.currentTarget.setPointerCapture(e.pointerId)
    if (on !== comparing) {
      setComparing(on)
      eng.compare(on)
    }
  }

  if (eng.fatal !== null) return <FatalScreen fatal={eng.fatal} />

  const strength = look === null ? 0 : Math.round(look.strength * 100)
  const strip: readonly string[] = tape.loaded
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
            title="hold to see the camera without the look"
            onPointerDown={hold(true)}
            onPointerUp={hold(false)}
            onPointerCancel={hold(false)}
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
                className={cx(styles.switch, tape.loaded && styles.on)}
                aria-pressed={tape.loaded}
                aria-label={
                  tape.loaded
                    ? 'take the tape off B'
                    : 'record a tape to mix under the camera'
                }
                title={
                  tape.loaded
                    ? 'take the tape off B'
                    : 'record a tape to mix under the camera'
                }
                disabled={tape.left > 0 || capture.recording}
                onClick={tape.loaded ? ejectTape : recordTape}
              >
                <TapeIcon />
              </button>
            </div>
          ) : null}
          {tape.left > 0 ? (
            <span className={cx(styles.badge, styles.rec)}>
              tape {tape.left}
            </span>
          ) : null}
          {comparing ? <span className={styles.badge}>original</span> : null}
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
            onClick={pickNormal}
          >
            normal
          </button>
          {strip.map(name => {
            const on = look !== null && !look.rolled && look.name === name
            return (
              <button
                key={name}
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
          {cam.canFlip ? (
            <button
              className={styles.flip}
              aria-label={
                cam.facing === 'user'
                  ? 'switch to the back camera'
                  : 'switch to the front camera'
              }
              onClick={cam.flip}
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
