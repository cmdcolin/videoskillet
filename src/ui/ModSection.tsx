import { useControlsApi } from './ControlsContext'
import { cx } from './cx'
import { MOTION } from './midi'
import styles from './ModSection.module.css'
import {
  gateFlips,
  isBayKey,
  modDetail,
  modReading,
  targetLabel,
} from './modSlots'
import { useModSlotsApi } from './ModSlotsContext'
import { groupOf, stageOf } from './placement'
import { Section } from './Section'
import { useHold } from './useHold'

import type { ModTarget } from '../core/controls'
import type { UiSlot } from './modSlots'

// Everything the bay is driving, and one fader that scales all of it. Shown
// only once something is patched or the gate is dialed on; with an empty bay
// there is nothing to list or scale. The editors stay in the MODULATION box on
// the map, which the footer opens.
export function ModSection(props: {
  moving: boolean
  onToggleMoving: () => void
  openStages: ReadonlySet<string>
  onOpenGroup: (stage: string, group: string) => void
  onOpenBay: () => void
}) {
  const { slots, master, setMaster, stab, stabHz, bpm, setEditing } =
    useModSlotsApi()
  const api = useControlsApi()
  const hold = useHold(master, setMaster)

  const patched = slots.filter(
    (s): s is UiSlot & { target: ModTarget } => s.target !== '',
  )
  const driven = patched.filter(s => s.on && s.depth > 0)
  const stilled = patched.filter(s => !s.on && s.depth > 0)
  const gated = stab.hz > 0
  if (patched.length === 0 && !gated) return null

  const rate = stabHz.toFixed(1).replace(/\.0$/, '')
  const gateName = gateFlips(stab) ? 'look flip' : 'stab gate'
  const pct = Math.round(master * 100)
  const summary = hold.frozen
    ? 'frozen'
    : [
        `${driven.length + (gated ? 1 : 0)} moving`,
        stilled.length === 0 ? '' : `${stilled.length} held`,
        `${pct}%`,
      ]
        .filter(s => s !== '')
        .join(' · ')

  const bind = api.bindLabel(MOTION)
  const armed = api.armed === MOTION
  const label = (s: (typeof patched)[number]) =>
    `${targetLabel(s.target)} (${modReading(s, bpm)})`

  return (
    <Section
      title="Modulation"
      summary={summary}
      help={
        <button
          className={cx(styles.count, props.moving && styles.countOn)}
          aria-pressed={props.moving}
          title={[
            driven.length === 0
              ? 'nothing is moving'
              : driven.map(label).join(', '),
            stilled.length === 0
              ? ''
              : `held still: ${stilled.map(label).join(', ')}`,
            props.moving
              ? 'showing every patched row — click to show the whole panel again'
              : 'click to narrow the panel down to every patched row',
          ]
            .filter(s => s !== '')
            .join(' — ')}
          onClick={props.onToggleMoving}
        >
          {`${driven.length} mod`}
          {stilled.length === 0 ? null : (
            <span className={styles.parked}>{`+${stilled.length}`}</span>
          )}
          {gated && stabHz > 0 ? ` ${rate}/s` : null}
        </button>
      }
    >
      <div className={styles.strip}>
        <button
          className={cx(styles.freeze, hold.frozen && styles.frozen)}
          title={
            hold.frozen
              ? 'let the motion run again, from where it stopped'
              : 'hold everything still — each wave keeps its place, so it picks up where it left off'
          }
          onClick={hold.toggle}
        >
          {hold.frozen ? '▶' : '❚❚'}
        </button>
        <label
          className={styles.label}
          htmlFor="motion-amount"
          title="scales the depth of every routing below at once"
        >
          amount
        </label>
        <input
          id="motion-amount"
          className={styles.range}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={master}
          onChange={e => setMaster(Number(e.target.value))}
        />
        <span className={styles.pct}>{`${pct}%`}</span>
        {api.midiReady ? (
          <button
            className={cx(
              styles.bind,
              armed ? styles.bindArmed : bind !== null && styles.bindSet,
            )}
            title={
              bind === null
                ? 'assign a MIDI control'
                : `MIDI CC${bind} — click to relearn`
            }
            onClick={() => api.toggleArm(MOTION)}
          >
            {armed ? 'learn…' : bind === null ? '⚟' : `CC${bind}`}
          </button>
        ) : null}
      </div>
      <ul className={styles.list}>
        {patched.map((s, i) => {
          const off = !s.on || s.depth === 0
          const group = isBayKey(s.target) ? undefined : groupOf(s.target)
          const stage = group === undefined ? null : stageOf(group)
          const name = targetLabel(s.target)
          const reachable =
            group !== undefined && stage !== null && props.openStages.has(stage)
          return (
            // Slots are positional; a slot's index is its identity.
            // oxlint-disable-next-line react/no-array-index-key
            <li key={i} className={cx(styles.item, off && styles.itemOff)}>
              {reachable ? (
                <button
                  className={styles.target}
                  title={`open ${group.name} in ${stage}, with this routing's editor unfolded under ${name}`}
                  onClick={() => {
                    props.onOpenGroup(stage, group.name)
                    setEditing(s.target, true)
                  }}
                >
                  {name}
                  <span className={styles.group}>{group.name}</span>
                </button>
              ) : (
                <span className={styles.target}>
                  {name}
                  {group === undefined ? null : (
                    <span className={styles.group}>{group.name}</span>
                  )}
                </span>
              )}
              <span
                className={styles.reading}
                title={`${modDetail(s, bpm)}${off ? ' — held still' : ''}`}
              >
                {`${modReading(s, bpm)} · ${
                  s.on ? `${Math.round(s.depth * master * 100)}%` : 'held'
                }`}
              </span>
            </li>
          )
        })}
        {gated ? (
          <li className={cx(styles.item, stabHz === 0 && styles.itemOff)}>
            <span className={styles.target}>{`whole board (${gateName})`}</span>
            <span className={styles.reading}>
              {stabHz === 0 ? 'held' : `${rate}/s`}
            </span>
          </li>
        ) : null}
      </ul>
      <button
        className={styles.open}
        title="open the MODULATION box on the map to edit sources, rates and depths"
        onClick={props.onOpenBay}
      >
        edit in the bay ›
      </button>
    </Section>
  )
}
