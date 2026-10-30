import styles from './cam.module.css'
import { MIX_MODES } from './looks'
import { Pick } from './Pick'
import { aOptions, bOptions } from './sources'

import type { Mix } from './looks'
import type { BSource } from './sources'
import type { Facing } from './useCamera'
import type { ASource } from './useSourceA'

// What is on each source and, once B has a picture, how the two meet. `owner`
// names what is working the mixer in place of its own modes.
export function Mixer(props: {
  canFlip: boolean
  sided: boolean
  facing: Facing
  onA: Facing | ASource
  onB: BSource
  busy: boolean
  cameraUp: boolean
  hasB: boolean
  owner: string | null
  mix: Mix
  onPutA: (key: Facing | ASource) => void
  onPutB: (key: BSource) => void
  onMix: (mix: Mix) => void
}) {
  const { mix } = props
  return (
    <div className={styles.mixer} aria-label="Mixer">
      <div className={styles.mixRow}>
        <Pick
          label="A"
          name="Source A"
          value={props.onA}
          disabled={props.busy}
          options={aOptions(props.canFlip, props.sided, props.facing)}
          onChange={props.onPutA}
        />
        <Pick
          label="B"
          name="Source B"
          value={props.onB}
          disabled={props.busy}
          options={bOptions(props.canFlip).map(src => ({
            ...src,
            disabled:
              !props.cameraUp &&
              (src.key === 'camera' ||
                src.key === 'same' ||
                src.key === 'record'),
          }))}
          onChange={props.onPutB}
        />
      </div>
      {props.hasB ? (
        <div className={styles.mixRow}>
          <Pick
            name="Mix"
            value={props.owner === null ? mix.mode : ''}
            placeholder={
              props.owner === null ? undefined : `by the ${props.owner}`
            }
            options={MIX_MODES.map(m => ({ key: m, label: m }))}
            onChange={m => props.onMix({ mode: m, fader: mix.fader })}
          />
          {props.owner !== null ? (
            <p className={styles.mixNote}>
              The {props.owner} is working the mixer. Pick a mode to take it
              back.
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
                  props.onMix({
                    mode: mix.mode,
                    fader: Number(e.target.value) / 100,
                  })
                }
              />
              <span>B</span>
            </label>
          )}
        </div>
      ) : null}
    </div>
  )
}
