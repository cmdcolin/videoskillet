import { useEffect, useEffectEvent, useRef } from 'react'

import { clamp01 } from '../core/math'
import { PASS_THROUGH, UNIPOLAR } from '../core/signal/modstate'
import { useControlsApi } from './ControlsContext'
import { cx } from './cx'
import { MOTION } from './midi'
import styles from './ModSection.module.css'
import {
  bayDef,
  gateFlips,
  isBayKey,
  modDetail,
  modReading,
  slotRate,
  targetLabel,
} from './modSlots'
import { useModSlotsApi } from './ModSlotsContext'
import { groupOf, stageOf } from './placement'
import { Section } from './Section'
import { useHold } from './useHold'

import type { ModTarget } from '../core/controls'
import type { UiSlot } from './modSlots'
import type { ReactNode, RefObject } from 'react'

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
  const { slots, master, setMaster, stab, stabHz, bpm } = useModSlotsApi()
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
      <RoutingList
        openStages={props.openStages}
        onOpenGroup={props.onOpenGroup}
      >
        {gated ? (
          <li className={cx(styles.item, stabHz === 0 && styles.itemOff)}>
            <span className={styles.target}>{`whole board (${gateName})`}</span>
            <span className={styles.reading}>
              {stabHz === 0 ? 'held' : `${rate}/s`}
            </span>
          </li>
        ) : null}
      </RoutingList>
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

const hzText = (hz: number) => `${Number(hz.toFixed(2))}Hz`

const keep =
  (refs: RefObject<Map<number, HTMLSpanElement>>, i: number) =>
  (el: HTMLSpanElement | null) => {
    if (el === null) refs.current.delete(i)
    else refs.current.set(i, el)
  }

function RoutingList(props: {
  openStages: ReadonlySet<string>
  onOpenGroup: (stage: string, group: string) => void
  children: ReactNode
}) {
  const { slots, master, bpm, setEditing, readLive } = useModSlotsApi()
  const dots = useRef(new Map<number, HTMLSpanElement>())
  const drives = useRef(new Map<number, HTMLSpanElement>())

  const draw = useEffectEvent(() => {
    const live = readLive()
    const seen = new Set<number>()
    live?.slots.forEach((e, k) => {
      seen.add(e.id)
      const v = live.values[k] ?? 0
      const at = UNIPOLAR.has(e.source) ? v : (v + 1) / 2
      const dot = dots.current.get(e.id)
      if (dot !== undefined) {
        dot.style.left = `${Math.round(clamp01(at) * 100)}%`
        dot.hidden = false
      }
      const slot = slots[e.id]
      const drive = drives.current.get(e.id)
      if (slot === undefined || drive === undefined) return
      const rateMoved =
        !PASS_THROUGH.has(e.source) &&
        Math.abs(e.rateHz - slotRate(slot, bpm)) > 0.005
      const depthMoved = Math.abs(e.depth - slot.depth * master) > 0.005
      const parts = [
        rateMoved ? hzText(e.rateHz) : '',
        depthMoved ? `${Math.round(e.depth * 100)}%` : '',
      ].filter(t => t !== '')
      const text = parts.length === 0 ? '' : `→ ${parts.join(' · ')}`
      if (drive.textContent !== text) drive.textContent = text
    })
    for (const [id, dot] of dots.current) if (!seen.has(id)) dot.hidden = true
    for (const [id, drive] of drives.current)
      if (!seen.has(id) && drive.textContent !== '') drive.textContent = ''
  })

  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      draw()
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <ul className={styles.list}>
      {slots.map((s, i) => {
        if (s.target === '') return null
        const target = s.target
        const off = !s.on || s.depth === 0
        const group = isBayKey(target) ? undefined : groupOf(target)
        const stage = group === undefined ? null : stageOf(group)
        const name = targetLabel(target)
        const drivenTarget = isBayKey(target)
          ? slots[bayDef(target).slot]?.target
          : undefined
        const where =
          group !== undefined
            ? group.name
            : drivenTarget === undefined || drivenTarget === ''
              ? null
              : `of ${targetLabel(drivenTarget)}`
        const groupName =
          where === null ? null : <span className={styles.group}>{where}</span>
        return (
          // Slots are positional; a slot's index is its identity.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={i} className={cx(styles.item, off && styles.itemOff)}>
            {group !== undefined &&
            stage !== null &&
            props.openStages.has(stage) ? (
              <button
                className={styles.target}
                title={`open ${group.name} in ${stage}, with this routing's editor unfolded under ${name}`}
                onClick={() => {
                  props.onOpenGroup(stage, group.name)
                  setEditing(target, true)
                }}
              >
                {name}
                {groupName}
              </button>
            ) : (
              <span
                className={styles.target}
                title={
                  stage === null
                    ? `${name} is a knob on another routing in this list`
                    : `${name} is in ${stage}, which has nothing patched into it — patch something there to reach its row`
                }
              >
                {name}
                {groupName}
              </span>
            )}
            <span className={styles.meter} aria-hidden>
              <span ref={keep(dots, i)} className={styles.dot} hidden />
            </span>
            <span
              className={styles.reading}
              title={`${modDetail(s, bpm)}${s.on ? '' : ' — held still'}`}
            >
              {`${modReading(s, bpm)} · ${
                !s.on
                  ? 'held'
                  : master === 0
                    ? 'frozen'
                    : `${Math.round(s.depth * master * 100)}%`
              }`}
              <span ref={keep(drives, i)} className={styles.drive} />
            </span>
          </li>
        )
      })}
      {props.children}
    </ul>
  )
}
