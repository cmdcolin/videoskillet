import { useRef, useState } from 'react'

import { DEFAULT_CONTROLS } from '../core/controls'
import { cx } from '../ui/cx'
import { FatalScreen } from '../ui/FatalScreen'
import { loopSlice, mixerSlice } from '../ui/hueKey'
import { usePersistedFlag } from '../ui/storage'
import { faultPlan } from '../ui/transitions'
import { useFlash } from '../ui/useFlash'
import { useWakeLock } from '../ui/useWakeLock'
import { Badges } from './Badges'
import styles from './cam.module.css'
import { CameraNotice } from './CameraNotice'
import { ClipInput } from './ClipInput'
import { Deck } from './Deck'
import { shareLink } from './deliver'
import { failureMessage } from './failure'
import { Hints } from './Hints'
import { instrumentHref } from './instrumentHref'
import { keysOnHue } from './keyed'
import { KeyRing } from './KeyRing'
import { writeLink } from './link'
import {
  MIX_SHELF,
  SHELVES,
  firesOnTap,
  lookBoard,
  lookLabel,
  openingLook,
  rollPool,
  shelfOf,
  stackLabel,
} from './looks'
import { LookStrip } from './LookStrip'
import { LOOP_KEYS, Loops } from './Loops'
import { Mixer } from './Mixer'
import { Modes } from './Modes'
import { PanelSwitches } from './PanelSwitches'
import { CLEAN, FIRST_MIX, boardOf, mixerOwned, sliceOf } from './scene'
import { SetSwitches } from './SetSwitches'
import { Shutter } from './Shutter'
import { TopBar } from './TopBar'
import { Tune } from './Tune'
import { useCamEngine } from './useCamEngine'
import { useCamera } from './useCamera'
import { useGestures } from './useGestures'
import { useKeyTap } from './useKeyTap'
import { useScene } from './useScene'
import { useSecond } from './useSecond'
import { useShutter } from './useShutter'
import { useSound } from './useSound'
import { useSourceA } from './useSourceA'
import { useSourcePicks } from './useSourcePicks'
import { canHear, useSpeech } from './useSpeech'
import { useTilt } from './useTilt'
import { trackOf, useZoom } from './useZoom'
import { ZoomStops } from './ZoomStops'

import type { Transition } from '../ui/transitions'
import type { Failure } from './failure'
import type { CamLink } from './link'
import type { Panel } from './PanelSwitches'
import type { Scene } from './scene'
import type { Step } from './undo'
import type { PointerEvent } from 'react'

const HINT_STORE = 'videoskillet_cam_hint_seen'
const SIDEWAYS_STORE = 'videoskillet_cam_sideways'

const scrollToChip = (name: string) =>
  document.querySelector(`[data-look="${name}"]`)?.scrollIntoView({
    inline: 'center',
    block: 'nearest',
    behavior: 'smooth',
  })

// A link opens on what it names, with its pattern on B. Anything else opens on
// a strong look.
const firstScene = (link: CamLink | null): Scene =>
  link === null
    ? { ...CLEAN, look: openingLook(), mix: null, keyer: null }
    : {
        ...CLEAN,
        base: link.base,
        look: link.look,
        layers: link.layers,
        tweaks: link.tweaks,
        mix: link.mix,
        keyer: null,
      }

const labelOf = (s: Step) =>
  s.look === null && s.base !== null
    ? s.base.name
    : stackLabel(s.look, s.layers)

export function CamPage(props: { link: CamLink | null }) {
  const firstB = props.link?.b ?? null
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sideways, setSideways] = usePersistedFlag(SIDEWAYS_STORE)
  const [opening] = useState(() => firstScene(props.link))
  // The wipe and the inset are laid out across the glass on show, so a new
  // layout lays the board again.
  const eng = useCamEngine(canvasRef, {
    sideways,
    firstBoard: () => boardOf(opening, sliceOf('whole')),
    firstB,
    onLayout: () => sc.paint({}),
  })
  const sc = useScene(() => opening, {
    showBoard: board => eng.showBoard(board),
    slice: () => sliceOf(eng.layoutNow()),
    holdA: on => void eng.holdA(on),
  })
  const { scene } = sc
  const zoom = useZoom(
    () => trackOf(eng.camera()?.video),
    eng.zoomA,
    eng.grabAgain,
  )
  const [failure, setFailure] = useState<Failure | null>(null)
  const srcA = useSourceA(
    {
      showVideo: (video, mirror) => {
        eng.showVideo(video, mirror)
        zoom.reset()
      },
      showPattern: pattern => {
        eng.showPattern(pattern)
        zoom.reset()
      },
    },
    setFailure,
  )
  const cam = useCamera((video, mirror) => {
    eng.showVideo(video, mirror)
    zoom.reset()
    srcA.cameraShown()
  })
  const tilt = useTilt(eng.steer)
  const sound = useSound(eng.hear, setFailure)
  const [captions, setCaptions] = useState(false)
  const second = useSecond(eng, cam, setFailure, firstB)
  const { shown: flash, flash: announce } = useFlash<string>(900)
  const [shelfName, setShelfName] = useState(() => shelfOf(scene.look).name)
  const [faults, setFaults] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [help, setHelp] = useState(false)
  const [hintSeen, setHintSeen] = usePersistedFlag(HINT_STORE)
  const [comparing, setComparing] = useState(false)
  const [firedOn, setFiredOn] = useState<string | null>(null)
  const { look } = scene
  const linked = look === null ? scene.base : null
  const label = labelOf(scene)
  // The mix tab opens while B has a picture to mix.
  const shelves = second.loaded ? [...SHELVES, MIX_SHELF] : SHELVES
  const shelf = shelves.find(s => s.name === shelfName) ?? SHELVES[0]!

  const shutter = useShutter(
    canvasRef,
    label,
    setFailure,
    () => eng.engine?.audioState.tap() ?? null,
  )

  useWakeLock(eng.engine !== null)

  const caption = (on: boolean) => {
    setCaptions(on)
    eng.caption(on)
  }

  useSpeech(captions, {
    onText: text => eng.say(text),
    onFail: e => {
      caption(false)
      setFailure({ during: 'captions', error: e })
    },
  })

  const undo = () => {
    const step = sc.undo()
    if (step !== undefined) {
      announce(labelOf(step))
      const chip =
        step.look === null || step.look.rolled ? null : step.look.name
      if (chip !== null) {
        const home = shelves.find(sh => sh.looks.includes(chip))
        if (home !== undefined && home !== shelf) setShelfName(home.name)
        else scrollToChip(chip)
      }
    }
  }

  // One panel is open at a time: opening one closes the one before it.
  const toggle = (p: Panel) => setPanel(panel === p ? null : p)

  // A tap puts a look up outright, the way a photo app's filter does, and a
  // second tap on the look already up opens its knobs.
  const pick = (name: string) => {
    if (look?.name === name && !look.rolled) toggle('tune')
    else sc.pick(name)
  }

  // A pad breaks the picture and lets it heal, and a held pad keeps it broken.
  // With a second picture on B, the cut lands on the frame the picture is least
  // legible and throws the fader to the other end, so the fault carries the
  // change of picture.
  const hit = (t: Transition, held: boolean) =>
    eng.engine?.startFault(faultPlan(t, () => sc.throwFader(), held))

  // A second picture opens the mix tab and the mixer, and dissolves halfway to
  // it under the look that is up. A change of picture on B keeps the mixer
  // where it was.
  const picks = useSourcePicks({
    firstB,
    cam,
    srcA,
    second,
    onError: setFailure,
    onMixing: () => {
      setShelfName(MIX_SHELF.name)
      setFaults(false)
      setPanel('mix')
      sc.paint({ mix: sc.now().mix ?? FIRST_MIX, keyer: null })
    },
    onTakeOff: () => sc.mixWith(null),
  })

  // The chroma keyer puts the camera on B as well as A and keys it, starting
  // on a green backing until a tap picks the colour. Switching it off takes the
  // camera off B.
  // A ref for the guard, since two taps can land before a render, and state for
  // the switch that shows it.
  const keyingRef = useRef(false)
  const [keying, setKeying] = useState(false)
  const switchKeyer = (on: boolean) => {
    const settled = keyingRef.current || on === (sc.now().keyer !== null)
    if (!settled && !on) picks.putOnB('none')
    else if (!settled) {
      keyingRef.current = true
      setKeying(true)
      void picks
        .keySame()
        .then(got => {
          if (got === 'shown') {
            sc.paint({
              keyer: { hue: DEFAULT_CONTROLS.bKeyHueDeg, backing: null },
            })
          } else if (got === 'failed') picks.putOnB('none')
        })
        .finally(() => {
          keyingRef.current = false
          setKeying(false)
        })
    }
  }

  const share = () => {
    const url = new URL(location.pathname, location.origin)
    url.hash = writeLink(sc.now(), second.pattern).toString()
    void shareLink(url.href, `videoskillet: ${label}`).then(
      word => word !== '' && announce(word),
    )
  }

  const flipTilt = () => {
    setFailure(null)
    void tilt.toggle().then(ok => {
      if (!ok) setFailure({ during: 'tilt', error: null })
    })
  }

  // A swipe steps along the tab's strip, the way a phone camera steps through
  // its filters, with normal at the start.
  const step = (dir: 1 | -1) => {
    const order: (string | null)[] = [null, ...shelf.looks]
    const at = look === null || look.rolled ? 0 : order.indexOf(look.name)
    const name =
      order[(Math.max(at, 0) + dir + order.length) % order.length] ?? null
    sc.land(name === null ? null : { name, strength: 1, rolled: false })
    announce(
      name === null
        ? 'normal'
        : lookLabel({ name, strength: 1, rolled: false }),
    )
    scrollToChip(name ?? 'normal')
  }

  const keyTap = useKeyTap({
    camera: eng.camera,
    keyed: () => {
      const s = sc.now()
      return s.keyer !== null || keysOnHue(lookBoard(s.look, s.layers).controls)
    },
    slice: () => {
      const s = sc.now()
      return s.keyer === null
        ? loopSlice(lookBoard(s.look, s.layers).controls)
        : mixerSlice(boardOf(s, sliceOf(eng.layoutNow())).controls)
    },
    onAim: (hue, backing) =>
      sc.paint({
        hue,
        keyer: sc.now().keyer === null ? null : { hue, backing },
      }),
    onMiss: announce,
  })

  const fires = firesOnTap(boardOf(scene, sliceOf(eng.layout)).mod)
  const firing =
    linked?.name ?? [look?.name, ...Object.keys(scene.layers)].join('+')

  // A tap fires the look's one-shots, and aims a colour key where the look has
  // one.
  const tap = (e: PointerEvent<HTMLCanvasElement>) => {
    if (fires) {
      eng.engine?.fireMod()
      setFiredOn(firing)
    }
    keyTap.tap(e)
  }

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
    onTap: tap,
  })

  if (eng.fatal !== null) return <FatalScreen fatal={eng.fatal} />

  const cameraUp = srcA.on === 'camera' && cam.state === 'on'
  const on = srcA.on !== 'camera' || cam.state === 'on'
  const tweaked = Object.keys(scene.tweaks).length > 0
  const ownedMixer = mixerOwned(scene)
  const busy = second.left > 0 || second.opening || shutter.recording
  const showHelp = on && help
  const mixOpen = panel === 'mix' && eng.engine !== null
  const controls = () => boardOf(scene, sliceOf(eng.layout)).controls
  const flip =
    cameraUp && (cam.canFlip || second.live)
      ? {
          label: second.live
            ? 'swap the two cameras'
            : cam.facing === 'user'
              ? 'switch to the back camera'
              : 'switch to the front camera',
          onClick: () => picks.flipCamera(),
        }
      : null

  return (
    <div className={styles.page}>
      <TopBar
        help={help}
        canUndo={sc.canUndo}
        onUndo={() => undo()}
        onHelp={() => setHelp(!help)}
        onShare={share}
        fullHref={instrumentHref(
          scene,
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
            captions={{
              shown: canHear(),
              on: captions,
              onToggle: () => caption(!captions),
            }}
          />
          <PanelSwitches panel={panel} onToggle={toggle} />
          <ClipInput attach={picks.attachB} onFile={picks.clipOnB} />
          <ClipInput attach={picks.attachA} onFile={picks.clipOnA} />
          {cameraUp && !showHelp ? (
            <ZoomStops stops={zoom.stops} zoom={zoom.zoom} onZoom={zoom.set} />
          ) : null}
          <Badges
            tapeLeft={second.left}
            opening={second.opening}
            comparing={comparing}
            waiting={fires && firedOn !== firing}
            recording={shutter.recording}
            recSince={shutter.recSince}
          />
          {flash === null ? null : (
            <span className={styles.flash}>{flash}</span>
          )}
          {on && !hintSeen && !showHelp ? (
            <span className={styles.firstHint}>
              swipe for looks · hold for the original
            </span>
          ) : null}
          {keyTap.ring === null ? null : <KeyRing {...keyTap.ring} />}
          {showHelp ? <Hints onClose={() => setHelp(false)} /> : null}
          <CameraNotice
            rebuilding={eng.rebuilding !== null}
            frozen={eng.frozen}
            state={cam.state}
            error={cam.error}
            onCamera={srcA.on === 'camera'}
            onStart={() => picks.startCamera()}
          />
        </div>
      </main>

      <section className={styles.controls}>
        {failure === null ? null : (
          <p className={styles.error}>{failureMessage(failure)}</p>
        )}

        <div className={styles.tray}>
          {mixOpen ? (
            <Mixer
              canFlip={cam.canFlip}
              sided={cam.sided}
              facing={cam.facing}
              onA={picks.onA}
              onB={picks.onB}
              busy={busy}
              cameraUp={cameraUp}
              hasB={
                (scene.mix !== null || scene.keyer !== null) && second.loaded
              }
              owner={
                scene.keyer !== null ? 'colour key' : ownedMixer ? 'look' : null
              }
              mix={scene.mix ?? FIRST_MIX}
              onPutA={picks.putOnA}
              onPutB={picks.putOnB}
              onMix={mix => sc.mixWith(mix)}
            />
          ) : (
            <LookStrip
              shelves={shelves}
              shelf={shelf}
              faults={faults}
              normal={look === null && linked === null}
              look={look}
              layers={scene.layers}
              tweaked={tweaked}
              onShelf={name => {
                setShelfName(name)
                setFaults(false)
              }}
              onFaults={() => setFaults(true)}
              onRoll={() => sc.roll(rollPool(shelf))}
              onNormal={() => sc.land(null)}
              onPick={name => pick(name)}
              onWeigh={(name, w) => sc.weigh(name, w)}
            >
              <Deck onHit={hit} />
            </LookStrip>
          )}
        </div>

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
            keyer={{
              on: scene.keyer !== null,
              disabled: keying || busy || (!cameraUp && scene.keyer === null),
              onSwitch: switchKeyer,
            }}
            tweaked={Object.keys(scene.tweaks).some(k => LOOP_KEYS.has(k))}
            onKnob={(key, v) => sc.turnKnob(key, v)}
            onReset={() => sc.resetKnobs(k => !LOOP_KEYS.has(k))}
            onClose={() => setPanel(null)}
          />
        ) : null}
        {panel === 'tune' ? (
          <Tune
            title={label}
            look={look}
            layers={scene.layers}
            controls={controls()}
            tweaked={tweaked}
            onStrength={s => look !== null && sc.land({ ...look, strength: s })}
            onLayer={(name, w) => sc.layer(name, w)}
            onDrop={name => sc.drop(name)}
            onKnob={(key, v) => sc.turnKnob(key, v)}
            onReset={() => sc.paint({ tweaks: {} })}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </section>
    </div>
  )
}
