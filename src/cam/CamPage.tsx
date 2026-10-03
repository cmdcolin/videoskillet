import { useRef, useState } from 'react'

import { cx } from '../ui/cx'
import { FatalScreen } from '../ui/FatalScreen'
import { usePersistedFlag } from '../ui/storage'
import { faultPlan } from '../ui/transitions'
import { useWakeLock } from '../ui/useWakeLock'
import { Badges } from './Badges'
import styles from './cam.module.css'
import { CameraNotice } from './CameraNotice'
import { ClipInput } from './ClipInput'
import { Deck } from './Deck'
import { Hints } from './Hints'
import { instrumentHref } from './instrumentHref'
import { keysOnHue } from './keyed'
import { KeyRing } from './KeyRing'
import {
  MIX_SHELF,
  SHELVES,
  lookBoard,
  lookKnobs,
  lookLabel,
  rollLook,
  rollPool,
  stackLabel,
} from './looks'
import { LookStrip } from './LookStrip'
import { LOOP_KEYS, Loops } from './Loops'
import { Mixer } from './Mixer'
import { Modes } from './Modes'
import { PanelSwitches } from './PanelSwitches'
import { pickRoll, rollStack, rollTweaks } from './roll'
import {
  CLEAN,
  FIRST_MIX,
  boardOf,
  mixerOwned,
  sliceOf,
  without,
} from './scene'
import { SetSwitches } from './SetSwitches'
import { Shutter } from './Shutter'
import { TopBar } from './TopBar'
import { Tune } from './Tune'
import { useCamEngine } from './useCamEngine'
import { useCamera } from './useCamera'
import { useFlash } from './useFlash'
import { useGestures } from './useGestures'
import { useKeyTap } from './useKeyTap'
import { useSecond } from './useSecond'
import { useShutter } from './useShutter'
import { useSound } from './useSound'
import { useSourceA } from './useSourceA'
import { useSourcePicks } from './useSourcePicks'
import { useTilt } from './useTilt'
import { trackOf, useZoom } from './useZoom'
import { ZoomStops } from './ZoomStops'

import type { ControlKey } from '../core/controls'
import type { Transition } from '../ui/transitions'
import type { Look, Mix } from './looks'
import type { Panel } from './PanelSwitches'
import type { Roll } from './roll'
import type { Scene } from './scene'

const HINT_STORE = 'videoskillet_cam_hint_seen'
const SIDEWAYS_STORE = 'videoskillet_cam_sideways'

export function CamPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sideways, setSideways] = usePersistedFlag(SIDEWAYS_STORE)
  // The wipe and the inset are laid out across the glass on show, so a new
  // layout lays the board again.
  const eng = useCamEngine(canvasRef, {
    sideways,
    onLayout: () => paint({}),
  })
  const zoom = useZoom(() => trackOf(eng.camera()?.video), eng.zoomA)
  const [error, setError] = useState('')
  const srcA = useSourceA(eng, setError)
  const cam = useCamera((video, mirror) => {
    eng.showVideo(video, mirror)
    zoom.reset()
    srcA.cameraShown()
  })
  const tilt = useTilt(eng.steer)
  const sound = useSound(eng.hear, setError)
  const second = useSecond(eng, cam, setError)
  const { flash, announce } = useFlash()
  const [scene, setScene] = useState<Scene>({ ...CLEAN, mix: null })
  const sceneRef = useRef(scene)
  const [shelfName, setShelfName] = useState(SHELVES[0].name)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [help, setHelp] = useState(false)
  const [hintSeen, setHintSeen] = usePersistedFlag(HINT_STORE)
  const [comparing, setComparing] = useState(false)
  const { look } = scene
  // The mix tab opens while B has a picture to mix.
  const shelves = second.loaded ? [...SHELVES, MIX_SHELF] : SHELVES
  const shelf = shelves.find(s => s.name === shelfName) ?? SHELVES[0]

  const shutter = useShutter(
    canvasRef,
    stackLabel(look, scene.layers),
    setError,
    () => eng.engine?.audioState.tap() ?? null,
  )

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

  // One panel is open at a time: opening one closes the one before it.
  const toggle = (p: Panel) => setPanel(panel === p ? null : p)

  // A tap puts a look up outright, the way a photo app's filter does, and a
  // second tap on the look already up opens its knobs.
  const pick = (name: string) => {
    if (look !== null && look.name === name && !look.rolled) {
      toggle('tune')
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

  const roll = () => {
    const cur = sceneRef.current
    const kind: Roll = pickRoll(cur.look !== null)
    const pool = rollPool(shelf)
    if (kind === 'look') {
      land(rollLook(cur.look, pool))
    } else if (kind === 'stack') {
      paint({
        ...rollStack(cur.look, pool, 'normal'),
        tweaks: {},
        hue: null,
      })
    } else {
      const board = boardOf(cur, sliceOf(eng.layoutNow())).controls
      paint({
        tweaks: rollTweaks(
          board,
          cur.tweaks,
          lookKnobs(cur.look, cur.layers),
          kind,
          'normal',
        ),
      })
    }
  }

  const turnKnob = (key: ControlKey, value: number) =>
    paint({ tweaks: { ...sceneRef.current.tweaks, [key]: value } })

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

  // A second picture opens the mix tab and the mixer, and dissolves halfway to
  // it under the look that is up. A change of picture on B keeps the mixer
  // where it was.
  const picks = useSourcePicks({
    cam,
    srcA,
    second,
    onError: setError,
    onMixing: () => {
      setShelfName(MIX_SHELF.name)
      setPanel('mix')
      paint({ mix: sceneRef.current.mix ?? FIRST_MIX })
    },
    onTakeOff: () =>
      paint(
        mixerOwned(sceneRef.current) ? { ...CLEAN, mix: null } : { mix: null },
      ),
  })

  const flipTilt = () => {
    setError('')
    void tilt.toggle().then(ok => {
      if (!ok)
        setError(
          'Motion access was turned down. Allow it in the browser’s site settings and try again.',
        )
    })
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

  const keyTap = useKeyTap({
    camera: eng.camera,
    crop: zoom.crop,
    keyed: () => keysOnHue(lookBoard(look, scene.layers).controls),
    onAim: hue => paint({ hue }),
    onMiss: announce,
  })

  const gestures = useGestures({
    zoom,
    onPress: () => {
      if (!hintSeen) setHintSeen(true)
    },
    onCompare: on => {
      setComparing(on)
      eng.compare(on)
    },
    onSwipe: step,
    onTap: keyTap.tap,
  })

  if (eng.fatal !== null) return <FatalScreen fatal={eng.fatal} />

  const cameraUp = srcA.on === 'camera' && cam.state === 'on'
  const on = srcA.on !== 'camera' || cam.state === 'on'
  const tweaked = Object.keys(scene.tweaks).length > 0
  const ownedMixer = mixerOwned(scene)
  const stacked = Object.keys(scene.layers).length > 0
  const busy = second.left > 0 || second.opening || shutter.recording
  const showHelp = on && help
  const mixOpen = panel === 'mix' && eng.engine !== null
  const deckOpen = panel === 'deck' && on
  const controls = () => boardOf(scene, sliceOf(eng.layout)).controls
  const flip =
    cameraUp && (cam.canFlip || second.live)
      ? {
          label: second.live
            ? 'swap the two cameras'
            : cam.facing === 'user'
              ? 'switch to the back camera'
              : 'switch to the front camera',
          onClick: second.live ? () => void second.swap() : cam.flip,
        }
      : null

  return (
    <div className={styles.page}>
      <TopBar
        help={help}
        onHelp={() => setHelp(!help)}
        fullHref={instrumentHref(
          stacked ? null : look,
          cameraUp
            ? 'webcam'
            : srcA.on === 'camera' || srcA.on === 'clip'
              ? null
              : srcA.on,
          second.pattern,
        )}
      />

      <main className={styles.stage}>
        <div
          className={cx(styles.frame, eng.layout !== 'whole' && styles.turned)}
        >
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            title="hold to see the camera without the look, swipe for another look, pinch to zoom"
            onPointerDown={gestures.press}
            onPointerMove={gestures.drag}
            onPointerUp={gestures.release(false)}
            onPointerCancel={gestures.release(true)}
            onContextMenu={e => e.preventDefault()}
          />
          {on ? (
            <SetSwitches
              tilt={{
                supported: tilt.supported,
                on: tilt.on,
                onToggle: flipTilt,
              }}
              side={{
                shown: eng.layout !== 'whole',
                on: sideways,
                onToggle: () => {
                  setSideways(!sideways)
                  eng.standSideways(!sideways)
                },
              }}
              sound={{ on: sound.on, onToggle: sound.toggle }}
            />
          ) : null}
          {on ? <PanelSwitches panel={panel} onToggle={toggle} /> : null}
          <ClipInput attach={picks.attachB} onFile={picks.clipOnB} />
          <ClipInput attach={picks.attachA} onFile={picks.clipOnA} />
          {cameraUp && !showHelp ? (
            <ZoomStops stops={zoom.stops} zoom={zoom.zoom} onZoom={zoom.set} />
          ) : null}
          <Badges
            tapeLeft={second.left}
            opening={second.opening}
            comparing={comparing}
            recording={shutter.recording}
            recSince={shutter.recSince}
          />
          {flash === '' ? null : <span className={styles.flash}>{flash}</span>}
          {on && !hintSeen && !showHelp ? (
            <span className={styles.firstHint}>
              swipe for looks · hold for the original
            </span>
          ) : null}
          {keyTap.ring === null ? null : <KeyRing {...keyTap.ring} />}
          {showHelp ? <Hints onClose={() => setHelp(false)} /> : null}
          <CameraNotice
            rebuilding={eng.rebuilding}
            frozen={eng.frozen}
            state={cam.state}
            error={cam.error}
            onCamera={srcA.on === 'camera'}
            onStart={() => cam.start()}
          />
        </div>
      </main>

      <section className={styles.controls}>
        {error === '' ? null : <p className={styles.error}>{error}</p>}

        {mixOpen ? (
          <Mixer
            canFlip={cam.canFlip}
            sided={cam.sided}
            facing={cam.facing}
            onA={picks.onA}
            onB={picks.onB}
            busy={busy}
            cameraUp={cameraUp}
            hasB={scene.mix !== null && second.loaded}
            ownedByLook={ownedMixer}
            mix={scene.mix ?? FIRST_MIX}
            onPutA={picks.putOnA}
            onPutB={picks.putOnB}
            onMix={mixWith}
          />
        ) : null}

        {deckOpen ? <Deck onHit={hit} /> : null}

        {mixOpen || deckOpen ? null : (
          <LookStrip
            shelves={shelves}
            shelf={shelf}
            look={look}
            layers={scene.layers}
            tweaked={tweaked}
            onShelf={setShelfName}
            onRoll={roll}
            onNormal={() => land(null)}
            onPick={pick}
            onWeigh={weigh}
          />
        )}

        <Shutter
          shot={shutter.shot}
          mode={shutter.mode}
          recording={shutter.recording}
          flip={flip}
          onShutter={shutter.press}
        />

        <Modes
          mode={shutter.mode}
          disabled={shutter.recording}
          onMode={shutter.setMode}
        />

        {panel === 'loops' ? (
          <Loops
            controls={controls()}
            tweaked={Object.keys(scene.tweaks).some(k => LOOP_KEYS.has(k))}
            onKnob={turnKnob}
            onReset={() =>
              paint({
                tweaks: Object.fromEntries(
                  Object.entries(sceneRef.current.tweaks).filter(
                    ([k]) => !LOOP_KEYS.has(k),
                  ),
                ),
              })
            }
            onClose={() => setPanel(null)}
          />
        ) : null}
        {panel === 'tune' ? (
          <Tune
            look={look}
            layers={scene.layers}
            controls={controls()}
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
            onClose={() => setPanel(null)}
          />
        ) : null}
      </section>
    </div>
  )
}
