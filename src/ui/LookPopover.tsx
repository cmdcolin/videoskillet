import { useState } from 'react'

import { ControlSlider } from './ControlGroup'
import { cx } from './cx'
import barStyles from './LookBar.module.css'
import styles from './LookPopover.module.css'
import { groupOf, stageOf } from './placement'
import { Popover } from './Popover'
import { Rack } from './Slider'
import { useStacked } from './useStacked'

import type { Group, SliderDef } from './controls'

// What the look on screen is actually made of: every control sitting off stock,
// in signal-path order, as live rows under the group each came from.
//
// A menu off the look bar rather than a section in the panel. It used to be a
// section, at the top, and it was the one thing in the panel that grew on its
// own: every first edit of a control added a row above everything you work on,
// and the row under your pointer moved 44px down the screen mid-drag. Folding
// it, anchoring the scroller by hand and freezing every pad's box at the press
// each held for one case and leaked in the next. In the top layer it is laid
// out against nothing in the panel, so it can hold however many rows the look
// has and nothing moves.
//
// The rows are the real ones, so this is not a readout: the thing that made the
// look is the thing you drag, and each row carries its own ↺ for putting one
// piece back without losing the rest. The group captions between them are a
// way into that module on the map, so the menu doubles as a contents page for
// the look.
//
// On the stacked phone layout the button narrows the panel to the same rows
// instead. A menu 326px wide hanging off a button at the panel's left edge ran
// off a 390px screen, and the panel's own scroller already holds rows well.
export function LookPopover(props: {
  sliders: readonly SliderDef[]
  // The stages a caption can jump to right now — see GroupCaption.
  openStages: ReadonlySet<string>
  onOpenGroup: (stage: string, group: string) => void
  showing: boolean
  onToggleShowing: () => void
}) {
  const stacked = useStacked()
  // Membership is sticky: a row leaving the list the instant it reaches its
  // default would unmount the range input mid-drag, which is the ordinary way
  // to turn a fault off. The list only re-syncs when a key arrives that it
  // didn't have — a preset, a mutate, a saved look, a link — or when the board
  // is cleaned outright.
  const [held, setHeld] = useState<readonly SliderDef[]>(props.sliders)
  const stale =
    props.sliders.some(s => !held.includes(s)) ||
    (props.sliders.length === 0 && held.length > 0)
  if (stale) setHeld(props.sliders)
  const list = stale ? props.sliders : held
  const count = props.sliders.length
  const label = `this look${count === 0 ? '' : ` ${count}`}`
  if (stacked)
    return (
      <button
        className={cx(styles.trigger, props.showing && barStyles.btnOn)}
        aria-pressed={props.showing}
        title="narrow the panel to every control this look moves off stock"
        onClick={props.onToggleShowing}
      >
        {label}
      </button>
    )
  return (
    <Popover
      trigger={attrs => (
        <button
          {...attrs}
          className={styles.trigger}
          title="every control this look moves off stock, as live rows — drag one, or put one piece back with its ↺"
        >
          {label}
        </button>
      )}
    >
      {id => (
        <div className={styles.body}>
          {list.length === 0 ? (
            <div className={styles.empty}>
              every control is at its default — move one and it turns up here
            </div>
          ) : (
            <Rack sliders={list}>
              {list.map((s, i) => {
                const group = groupOf(s.key)
                const prev = i === 0 ? undefined : groupOf(list[i - 1].key)
                return (
                  <div key={s.key}>
                    {group === prev ? null : (
                      <GroupCaption
                        group={group}
                        closes={id}
                        openStages={props.openStages}
                        onOpen={props.onOpenGroup}
                      />
                    )}
                    <ControlSlider slider={s} />
                  </div>
                )
              })}
            </Rack>
          )}
        </div>
      )}
    </Popover>
  )
}

// Which module the rows under it came from, and the way back to it on the map.
// Only a button for a group in a stage that will actually open: a branch — the
// sound, input B — and, for B, the mixer it arrives at open onto nothing while
// that branch has no input.
function GroupCaption(props: {
  group: Group | undefined
  closes: string
  openStages: ReadonlySet<string>
  onOpen: (stage: string, group: string) => void
}) {
  const group = props.group
  if (group === undefined) return null
  const stage = stageOf(group)
  return props.openStages.has(stage) ? (
    <button
      className={styles.from}
      title={`open ${group.name} in the ${stage} stage`}
      popoverTarget={props.closes}
      popoverTargetAction="hide"
      onClick={() => props.onOpen(stage, group.name)}
    >
      {group.name}
    </button>
  ) : (
    <div className={styles.from}>{group.name}</div>
  )
}
