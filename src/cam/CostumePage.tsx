import { useRef, useState } from 'react'

import { debugLog } from '../core/gpu/env'
import { cx } from '../ui/cx'
import { FatalScreen } from '../ui/FatalScreen'
import { faultPlan } from '../ui/transitions'
import { useWakeLock } from '../ui/useWakeLock'
import camStyles from './cam.module.css'
import { CameraNotice } from './CameraNotice'
import { BOOP_REST_MS, rollBoop, roused } from './costume'
import styles from './costume.module.css'
import { openingLook } from './looks'
import { CLEAN, boardOf, sliceOf } from './scene'
import { useBoops } from './useBoops'
import { useCamEngine } from './useCamEngine'
import { useCamera } from './useCamera'
import { canHear, useSpeech } from './useSpeech'
import { allowMotion } from './useTilt'

import type { CostumeSettings } from './costume'
import type { Scene } from './scene'
import type { BoopSource } from './useBoops'
import type { Facing } from './useCamera'

// The camera page with nothing on it but the picture, for wearing. Each boop
// breaks the picture with a fault from the deck and lands a random look under
// it.
export function CostumePage(props: { settings: CostumeSettings }) {
  const { settings } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scene = useRef<Scene>({
    ...CLEAN,
    look: openingLook(),
    mix: null,
    keyHue: null,
  })
  const restUntil = useRef(0)
  const lastBoop = useRef(0)
  const boardNow = (slice: number) => {
    const board = boardOf(scene.current, slice)
    return { ...board, controls: roused(board.controls) }
  }
  const show = () => eng.showBoard(boardNow(sliceOf(eng.layoutNow())))
  const eng = useCamEngine(canvasRef, {
    sideways: false,
    firstBoard: () => boardNow(1),
    firstB: null,
    onLayout: () => show(),
  })
  const cam = useCamera((video, mirror) => eng.showVideo(video, mirror))
  const [started, setStarted] = useState(false)
  const [motion, setMotion] = useState(false)
  const [sound, setSound] = useState(false)
  const [talk, setTalk] = useState(true)
  const [captioning, setCaptioning] = useState(false)

  useWakeLock(eng.engine !== null)

  const boop = (source: BoopSource) => {
    const now = performance.now()
    if (eng.engine !== null && now >= restUntil.current) {
      const next = rollBoop(scene.current.look)
      restUntil.current = now + next.fault.seconds * 1000 + BOOP_REST_MS
      lastBoop.current = now
      debugLog(
        `boop ${source}: ${next.fault.name} to ${[next.look.name, ...Object.keys(next.layers)].join('+')}`,
      )
      eng.engine.startFault(
        faultPlan(next.fault, () => {
          scene.current = {
            ...scene.current,
            look: next.look,
            layers: next.layers,
          }
          show()
        }),
      )
    }
  }

  useSpeech(captioning, {
    fallback: settings.say,
    onText: text => eng.engine?.setCaption(text),
    onPhrase: () => boop('voice'),
  })

  useBoops({
    motion,
    threshold: settings.threshold,
    sound,
    hit: () => eng.engine?.audioState.hit ?? 0,
    autoS: started ? settings.autoS : 0,
    idle: () => performance.now() - lastBoop.current,
    onBoop: boop,
  })

  // Fullscreen, motion and the microphone are granted only from inside a tap.
  // Without the microphone the set ignores the room and boops still work.
  const start = (facing: Facing) => {
    if (document.fullscreenEnabled)
      void document.documentElement.requestFullscreen().catch(() => {})
    void allowMotion().then(ok => setMotion(ok))
    eng.hear(true).then(
      () => setSound(true),
      (e: unknown) => debugLog('costume sound refused', e),
    )
    cam.start(facing)
    lastBoop.current = performance.now()
    if (talk) {
      scene.current = { ...scene.current, tweaks: { cgMix: 1 } }
      show()
      setCaptioning(true)
    }
    setStarted(true)
  }

  if (eng.fatal !== null) return <FatalScreen fatal={eng.fatal} />

  return (
    <div className={styles.page}>
      <div
        className={cx(styles.frame, eng.layout !== 'whole' && styles.turned)}
      >
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={() => boop('tap')}
          onContextMenu={e => e.preventDefault()}
        />
        {started ? (
          <CameraNotice
            rebuilding={eng.rebuilding !== null}
            frozen={eng.frozen}
            state={cam.state}
            error={cam.error}
            onCamera
            onStart={() => cam.start(cam.facing)}
          />
        ) : (
          <div className={camStyles.notice}>
            <p>
              Tap the screen, knock on the phone, talk, make a loud noise or
              press a button on a Bluetooth remote for a new picture. It also
              changes by itself every so often.
            </p>
            <label className={styles.talk}>
              <input
                type="checkbox"
                checked={talk}
                onChange={e => setTalk(e.target.checked)}
              />
              {canHear()
                ? `Show what people say, and “${settings.say}” when it is quiet`
                : `Show “${settings.say}”`}
            </label>
            <div className={styles.starts}>
              <button className={camStyles.start} onClick={() => start('user')}>
                Screen-side camera
              </button>
              <button
                className={camStyles.start}
                onClick={() => start('environment')}
              >
                Back camera
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
