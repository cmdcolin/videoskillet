import { useEffect, useRef, useState } from 'react'

import { publicUrl } from '../publicUrl'
import { cx } from '../ui/cx'
import { save } from '../ui/download'
import { FatalScreen } from '../ui/FatalScreen'
import { usePersistedFlag } from '../ui/storage'
import { TRANSITIONS, faultPlan } from '../ui/transitions'
import { useCapture } from '../ui/useCapture'
import { useWakeLock } from '../ui/useWakeLock'
import styles from './cam.module.css'
import {
  DiceIcon,
  FlipIcon,
  MicIcon,
  ShareIcon,
  SideIcon,
  SlidersIcon,
  TapeIcon,
  TiltIcon,
} from './icons'
import { aimKey, chromaHue, colourAt, keysOnHue, sourcePoint } from './keyed'
import { LookChip } from './LookChip'
import {
  MIX_MODES,
  MIX_SHELF,
  SHELVES,
  lookBoard,
  lookLabel,
  mixControls,
  mixesItself,
  rollLook,
  rollPool,
  stackLabel,
} from './looks'
import { SLICE } from './tape'
import { Tune } from './Tune'
import { PATTERNS, PATTERN_TITLE, useCamEngine } from './useCamEngine'
import { useCamera } from './useCamera'
import { useSecond } from './useSecond'
import { useTilt } from './useTilt'
import { useZoom } from './useZoom'
import { stopAt, zoomLabel } from './zoom'

import type { ControlKey, Controls } from '../core/controls'
import type { Transition } from '../ui/transitions'
import type { Layers, Look, Mix } from './looks'
import type { Layout } from './tape'
import type { Pattern } from './useCamEngine'
import type { ChangeEvent, PointerEvent, ReactNode } from 'react'

type Mode = 'photo' | 'video'
type BSource = 'none' | 'camera' | 'record' | 'clip' | Pattern

// A press becomes the original after it has been held this long, so a swipe or
// a tap never flashes it.
const HOLD_MS = 180
const SWIPE_PX = 40
const TAP_PX = 10

const HINT_STORE = 'videoskillet_cam_hint_seen'
const SIDEWAYS_STORE = 'videoskillet_cam_sideways'
const DECK_STORE = 'videoskillet_cam_deck'

const sliceOf = (layout: Layout) => (layout === 'slice' ? SLICE : 1)

interface Gesture {
  id: number
  x: number
  y: number
  timer: number
  kind: 'pending' | 'compare' | 'swipe'
}

interface Pinch {
  span: number
  zoom: number
}

// The last thing the shutter made, held until the next one replaces it.
interface Shot {
  blob: Blob
  name: string
  url: string
  video: boolean
}

// Everything the board is built from: the look, the presets dragged in partway
// on top of it, the knobs moved off both, the mixer while B has a picture, and
// where a tap has aimed the look's keyer.
interface Scene {
  look: Look | null
  layers: Layers
  tweaks: Partial<Controls>
  mix: Mix | null
  hue: number | null
}

const CLEAN = { look: null, layers: {}, tweaks: {}, hue: null } as const

// A look that sets the mixer itself keeps it; the mixer's own modes run under
// every other look.
const mixerOwned = (s: Scene) =>
  [...(s.look === null ? [] : [s.look.name]), ...Object.keys(s.layers)].some(
    mixesItself,
  )

const boardOf = (s: Scene, slice: number) => {
  const board = lookBoard(s.look, s.layers)
  const controls = {
    ...board.controls,
    ...s.tweaks,
    ...(s.mix === null || mixerOwned(s) ? {} : mixControls(s.mix, slice)),
  }
  return { ...board, controls: aimKey(controls, s.hue) }
}

const FIRST_MIX: Mix = { mode: 'dissolve', fader: 0.5 }

const without = (layers: Layers, name: string): Layers =>
  Object.fromEntries(Object.entries(layers).filter(([n]) => n !== name))

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

const trackOf = (video: HTMLVideoElement | undefined) =>
  video?.srcObject instanceof MediaStream
    ? (video.srcObject.getVideoTracks()[0] ?? null)
    : null

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

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

// A round switch on the picture with its name under it.
function Switch(props: {
  on: boolean
  label: string
  title: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      className={styles.switch}
      aria-pressed={props.on}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <span className={cx(styles.switchDot, props.on && styles.on)}>
        {props.children}
      </span>
      <span className={styles.switchLabel}>{props.label}</span>
    </button>
  )
}

const HINTS: [string, string][] = [
  ['swipe', 'step to the next or previous look'],
  ['hold', 'see the camera without the look'],
  ['pinch', 'zoom, or tap a lens stop under the picture'],
  ['tap', 'aim the key at a colour, on looks that key by colour'],
  ['drag up', 'on a look, mixes it in partway; stack as many as you like'],
]

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
  const clipRef = useRef<HTMLInputElement>(null)
  const [sideways, setSideways] = usePersistedFlag(SIDEWAYS_STORE)
  const [deck, setDeck] = usePersistedFlag(DECK_STORE)
  // The wipe and the inset are laid out across the glass on show, so a new
  // layout lays the board again.
  const eng = useCamEngine(canvasRef, {
    sideways,
    onLayout: () => paint({}),
  })
  const zoom = useZoom(() => trackOf(eng.camera()?.video), eng.zoomA)
  const cam = useCamera((video, mirror) => {
    eng.showVideo(video, mirror)
    zoom.reset()
  })
  const tilt = useTilt(eng.steer)
  const [scene, setScene] = useState<Scene>({ ...CLEAN, mix: null })
  const sceneRef = useRef(scene)
  const [shelfName, setShelfName] = useState(SHELVES[0].name)
  const [tuning, setTuning] = useState(false)
  const [help, setHelp] = useState(false)
  const [hintSeen, setHintSeen] = usePersistedFlag(HINT_STORE)
  const [mode, setMode] = useState<Mode>('photo')
  const [comparing, setComparing] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const [error, setError] = useState('')
  const [recSince, setRecSince] = useState(0)
  const second = useSecond(eng, cam, setError)
  const [picked, setPicked] = useState<BSource>('none')
  const [sound, setSound] = useState(false)
  const [flash, setFlash] = useState('')
  const [ring, setRing] = useState<{
    x: number
    y: number
    rgb: string
  } | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<Pinch | null>(null)
  const flashTimer = useRef(0)
  const ringTimer = useRef(0)
  const { look } = scene
  // The mix tab opens while B has a picture to mix.
  const shelves = second.loaded ? [...SHELVES, MIX_SHELF] : SHELVES
  const shelf = shelves.find(s => s.name === shelfName) ?? SHELVES[0]

  const capture = useCapture(
    canvasRef,
    stackLabel(look, scene.layers),
    setError,
    (blob, name) =>
      setShot({
        blob,
        name,
        url: URL.createObjectURL(blob),
        video: blob.type.startsWith('video/'),
      }),
    // 30fps, which is what a phone's own camera records, and half the
    // encoding a phone's encoder has to keep up with.
    {
      clock: true,
      fps: { num: 30, den: 1 },
      audio: () => eng.engine?.audioState.tap() ?? null,
    },
  )

  useEffect(() => {
    if (shot === null) return undefined
    const url = shot.url
    return () => URL.revokeObjectURL(url)
  }, [shot])

  useWakeLock(eng.engine !== null)

  const paint = (next: Partial<Scene>) => {
    const s = { ...sceneRef.current, ...next }
    sceneRef.current = s
    setScene(s)
    eng.showBoard(boardOf(s, sliceOf(eng.layoutNow())))
  }

  // A tap's aim and the knobs moved off a look last while that look stays up,
  // through a change of strength. A new look goes under whatever is stacked on
  // the old one; normal takes the stack off too.
  const land = (next: Look | null) => {
    const cur = sceneRef.current
    if (next === null) {
      paint(CLEAN)
      return
    }
    const same = cur.look !== null && next.name === cur.look.name
    paint({
      look: next,
      layers: without(cur.layers, next.name),
      hue: same ? cur.hue : null,
      tweaks: same ? cur.tweaks : {},
    })
  }
  // A tap puts a look up outright, the way a photo app's filter does, and a
  // second tap on the look already up opens its knobs.
  const pick = (name: string) => {
    if (look !== null && look.name === name && !look.rolled) {
      setTuning(!tuning)
      return
    }
    paint({ ...CLEAN, look: { name, strength: 1, rolled: false } })
  }
  // A chip dragged up mixes its preset in partway: as the look when nothing
  // is up, as the look's strength when it is the look, and stacked on the look
  // otherwise.
  const weigh = (name: string, w: number) => {
    const cur = sceneRef.current
    if (cur.look === null) {
      paint({ ...CLEAN, look: { name, strength: w, rolled: false } })
    } else if (cur.look.name === name) {
      paint({ look: { ...cur.look, strength: w } })
    } else {
      const rest = without(cur.layers, name)
      paint({ layers: w > 0 ? { ...rest, [name]: w } : rest })
    }
  }
  const roll = () => land(rollLook(look, rollPool(shelf)))

  const turnKnob = (key: ControlKey, value: number) =>
    paint({ tweaks: { ...sceneRef.current.tweaks, [key]: value } })

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
  // or as a tape. The scene behind the phone and the person holding it share
  // the picture.
  const mixCamera = () => {
    second.eject()
    setError('')
    void second.load().then(got => {
      if (got === null) {
        takeOff()
        return
      }
      if (got === 'tape' && cam.canFlip) cam.flip()
      mixing('camera')
    })
  }
  const mixTape = () => {
    second.eject()
    setError('')
    void second.record().then(ok => (ok ? mixing('record') : takeOff()))
  }
  const mixPattern = (p: Pattern) => {
    setError('')
    second.loadPattern(p)
    mixing(p)
  }
  const mixClip = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file === undefined) return
    second.eject()
    setError('')
    void second.loadClip(file).then(ok => (ok ? mixing('clip') : takeOff()))
  }
  // A second picture opens the mix tab and dissolves halfway to it under the
  // look that is up. A change of picture on B keeps the mixer where it was.
  const mixing = (from: BSource) => {
    setPicked(from)
    setShelfName(MIX_SHELF.name)
    paint({ mix: sceneRef.current.mix ?? FIRST_MIX })
  }
  // The mixer's own modes take the mixer back from a look that set it.
  const mixWith = (mix: Mix) =>
    paint(mixerOwned(sceneRef.current) ? { ...CLEAN, mix } : { mix })
  // A pad breaks the picture and lets it heal. With a second picture on B, the
  // cut lands on the frame the picture is least legible and throws the fader to
  // the other end, so the fault carries the change of picture.
  const hit = (t: Transition) => {
    eng.engine?.startFault(
      faultPlan(t, () => {
        const s = sceneRef.current
        if (s.mix !== null && !mixerOwned(s))
          paint({ mix: { ...s.mix, fader: s.mix.fader < 0.5 ? 1 : 0 } })
      }),
    )
  }

  const takeOff = () => {
    second.eject()
    paint(
      mixerOwned(sceneRef.current) ? { ...CLEAN, mix: null } : { mix: null },
    )
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

  // A swipe steps along the tab's strip, the way a phone camera steps through
  // its filters, with normal at the start.
  const step = (dir: 1 | -1) => {
    const order: (string | null)[] = [null, ...shelf.looks]
    const at = look === null || look.rolled ? 0 : order.indexOf(look.name)
    const name = order[(Math.max(at, 0) + dir + order.length) % order.length]
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
    if (c === null || !keysOnHue(lookBoard(look, scene.layers).controls)) return
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
        crop: zoom.crop,
      }),
    )
    if (rgb === null) return
    const hue = chromaHue(...rgb)
    if (hue === null) {
      announce('no colour there to key on')
      return
    }
    paint({ hue })
    setRing({
      ...at,
      rgb: `rgb(${rgb.map(v => Math.round(v * 255)).join(' ')})`,
    })
    window.clearTimeout(ringTimer.current)
    ringTimer.current = window.setTimeout(() => setRing(null), 800)
  }

  const endCompare = () => {
    setComparing(false)
    eng.compare(false)
  }

  // A second finger turns whatever the first one started into a pinch.
  const press = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!hintSeen) setHintSeen(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const g = gesture.current
      if (g !== null) {
        window.clearTimeout(g.timer)
        if (g.kind === 'compare') endCompare()
        gesture.current = null
      }
      const [a, b] = [...pointers.current.values()]
      pinch.current = { span: dist(a, b), zoom: zoom.zoom }
      return
    }
    if (pointers.current.size > 2) return
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
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = pinch.current
    if (p !== null && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      zoom.set((p.zoom * dist(a, b)) / Math.max(p.span, 1))
      return
    }
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
      pointers.current.delete(e.pointerId)
      if (pointers.current.size < 2) pinch.current = null
      const g = gesture.current
      if (g === null || g.id !== e.pointerId) return
      window.clearTimeout(g.timer)
      gesture.current = null
      if (g.kind === 'compare') {
        endCompare()
      } else if (
        !cancelled &&
        g.kind === 'pending' &&
        Math.hypot(e.clientX - g.x, e.clientY - g.y) < TAP_PX
      ) {
        tap(e)
      }
    }

  if (eng.fatal !== null) return <FatalScreen fatal={eng.fatal} />

  const on = cam.state === 'on'
  const tweaked = Object.keys(scene.tweaks).length > 0
  const ownedMixer = mixerOwned(scene)
  const stacked = Object.keys(scene.layers).length > 0
  const strength = look === null ? 0 : Math.round(look.strength * 100)
  const stop = stopAt(zoom.zoom, zoom.stops)
  const busy = second.left > 0 || second.opening || capture.recording
  const showHelp = on && help
  const mix = scene.mix ?? FIRST_MIX
  const noB = scene.mix === null || !second.loaded
  const sources: { key: BSource; label: string; title: string }[] = [
    { key: 'none', label: 'none', title: 'nothing on B' },
    ...(cam.canFlip
      ? [
          {
            key: 'camera' as const,
            label: 'other camera',
            title:
              'the other camera, live where the phone runs both, else a 4 s tape',
          },
        ]
      : []),
    {
      key: 'record',
      label: 'record 4 s',
      title: 'record 4 s of this camera and loop it on B',
    },
    { key: 'clip', label: 'clip', title: 'any video of yours, looped' },
    ...PATTERNS.map(p => ({ key: p, label: p, title: PATTERN_TITLE[p] })),
  ]
  const onB: BSource = second.kind === null ? 'none' : picked
  const putOnB = (key: BSource) => {
    if (key === 'none') takeOff()
    else if (key === 'camera') mixCamera()
    else if (key === 'record') mixTape()
    else if (key === 'clip') clipRef.current?.click()
    else mixPattern(key)
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <a className={styles.brand} href="../" aria-label="videoskillet home">
          <img className={styles.mark} src={publicUrl('favicon.svg')} alt="" />
          <span className={styles.brandName}>videoskillet</span>
        </a>
        <span className={styles.topRight}>
          <button
            className={styles.help}
            aria-label="how to use the camera"
            aria-pressed={help}
            onClick={() => setHelp(!help)}
          >
            ?
          </button>
          <a
            className={styles.full}
            href={instrumentHref(stacked ? null : look, on)}
            title="open the whole instrument on this look"
          >
            full app ↗
          </a>
        </span>
      </header>

      <main className={styles.stage}>
        <div
          className={cx(styles.frame, eng.layout !== 'whole' && styles.turned)}
        >
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            title="hold to see the camera without the look, swipe for another look, pinch to zoom"
            onPointerDown={press}
            onPointerMove={drag}
            onPointerUp={release(false)}
            onPointerCancel={release(true)}
            onContextMenu={e => e.preventDefault()}
          />
          {on ? (
            <div className={cx(styles.switches, styles.left)}>
              {tilt.supported ? (
                <Switch
                  on={tilt.on}
                  label="tilt"
                  title="steer the loop by tilting the phone"
                  onClick={flipTilt}
                >
                  <TiltIcon />
                </Switch>
              ) : null}
              {eng.layout === 'whole' ? null : (
                <Switch
                  on={sideways}
                  label="on side"
                  title="stand the set on its side, so the scan runs down the picture"
                  onClick={() => {
                    setSideways(!sideways)
                    eng.standSideways(!sideways)
                  }}
                >
                  <SideIcon />
                </Switch>
              )}
              <Switch
                on={sound}
                label="sound"
                title="let the room's sound shake the set"
                onClick={flipSound}
              >
                <MicIcon />
              </Switch>
            </div>
          ) : null}
          {on ? (
            <div className={cx(styles.switches, styles.right)}>
              <Switch
                on={tuning}
                label="tune"
                title="the look's own knobs"
                onClick={() => setTuning(!tuning)}
              >
                <SlidersIcon />
              </Switch>
              <Switch
                on={deck}
                label="deck"
                title="fault pads that break the picture and let it heal"
                onClick={() => setDeck(!deck)}
              >
                <TapeIcon />
              </Switch>
            </div>
          ) : null}
          <input
            ref={clipRef}
            type="file"
            accept="video/*"
            hidden
            onChange={mixClip}
          />
          {on && !showHelp ? (
            <div className={styles.zoom} role="group" aria-label="Zoom">
              {zoom.stops.map(s => (
                <button
                  key={s}
                  className={cx(styles.zoomStop, s === stop && styles.zoomOn)}
                  aria-label={`zoom ${zoomLabel(s)}×`}
                  onClick={() => zoom.set(s)}
                >
                  {s === stop ? `${zoomLabel(zoom.zoom)}×` : zoomLabel(s)}
                </button>
              ))}
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
          {on && !hintSeen && !showHelp ? (
            <span className={styles.firstHint}>
              swipe for looks · hold for the original
            </span>
          ) : null}
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
          {showHelp ? (
            <button className={styles.hints} onClick={() => setHelp(false)}>
              <dl>
                {HINTS.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <span className={styles.hintsClose}>tap to close</span>
            </button>
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

        {on ? (
          <div className={styles.mixer} aria-label="Mixer">
            <div className={styles.sources}>
              <span className={styles.source}>
                <b>A</b>camera
              </span>
              <span className={styles.source}>
                <b>B</b>
              </span>
              <div
                className={styles.mixModes}
                role="radiogroup"
                aria-label="Source B"
              >
                {sources.map(src => {
                  const up = src.key === onB
                  return (
                    <button
                      key={src.label}
                      role="radio"
                      aria-checked={up}
                      className={cx(
                        styles.mixMode,
                        up &&
                          (src.key === 'none'
                            ? styles.mixModeEmpty
                            : styles.mixModeOn),
                      )}
                      disabled={busy}
                      title={src.title}
                      onClick={() => {
                        if (!up) putOnB(src.key)
                      }}
                    >
                      {src.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {noB ? null : (
              <>
                <div
                  className={styles.mixModes}
                  role="radiogroup"
                  aria-label="Mix"
                >
                  {MIX_MODES.map(m => {
                    const up = !ownedMixer && mix.mode === m
                    return (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={up}
                        className={cx(styles.mixMode, up && styles.mixModeOn)}
                        onClick={() => mixWith({ mode: m, fader: mix.fader })}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
                {ownedMixer ? (
                  <p className={styles.mixNote}>
                    The look is working the mixer. Pick a mode to take it back.
                  </p>
                ) : (
                  <label className={styles.fader}>
                    <span>A</span>
                    <input
                      className={styles.slider}
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(mix.fader * 100)}
                      aria-label="fader"
                      onChange={e =>
                        mixWith({
                          mode: mix.mode,
                          fader: Number(e.target.value) / 100,
                        })
                      }
                    />
                    <span>B</span>
                  </label>
                )}
              </>
            )}
          </div>
        ) : null}

        {on && deck ? (
          <div className={styles.hits} aria-label="Faults">
            {TRANSITIONS.map(t => (
              <button
                key={t.name}
                className={styles.hit}
                title={t.title}
                onClick={() => hit(t)}
              >
                <span className={styles.hitGlyph} aria-hidden>
                  {t.glyph}
                </span>
                {t.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.tabs} role="tablist" aria-label="Kinds of look">
          {shelves.map(s => (
            <button
              key={s.name}
              role="tab"
              aria-selected={s === shelf}
              className={cx(styles.tab, s === shelf && styles.tabOn)}
              onClick={() => setShelfName(s.name)}
            >
              {s.name}
            </button>
          ))}
        </div>

        <nav className={styles.strip} aria-label="Looks">
          <button
            className={cx(styles.chip, look?.rolled === true && styles.chipOn)}
            title={`a look picked at random from every one the ${shelf.name} tab's families hold`}
            onClick={roll}
          >
            <DiceIcon />
            {look?.rolled === true ? lookLabel(look) : 'random'}
          </button>
          <button
            className={cx(styles.chip, look === null && styles.chipOn)}
            data-look="normal"
            onClick={() => land(null)}
          >
            normal
          </button>
          {shelf.looks.map(name => {
            const up = look !== null && !look.rolled && look.name === name
            return (
              <LookChip
                key={name}
                name={name}
                label={lookLabel({ name, strength: 1, rolled: false })}
                up={up}
                weight={up ? look.strength : (scene.layers[name] ?? 0)}
                onPick={() => pick(name)}
                onWeigh={w => weigh(name, w)}
              >
                {up && (look.strength < 1 || tweaked) ? (
                  <span className={styles.chipStrength}>
                    {tweaked ? '•' : strength}
                  </span>
                ) : null}
              </LookChip>
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

        {tuning ? (
          <Tune
            look={look}
            layers={scene.layers}
            controls={boardOf(scene, sliceOf(eng.layout)).controls}
            tweaked={tweaked}
            onStrength={s => look !== null && land({ ...look, strength: s })}
            onLayer={(name, w) =>
              paint({ layers: { ...sceneRef.current.layers, [name]: w } })
            }
            onDrop={name =>
              paint({ layers: without(sceneRef.current.layers, name) })
            }
            onKnob={turnKnob}
            onReset={() => paint({ tweaks: {} })}
            onClose={() => setTuning(false)}
          />
        ) : null}
      </section>
    </div>
  )
}
