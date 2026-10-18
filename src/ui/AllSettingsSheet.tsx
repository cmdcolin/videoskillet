import { useState } from 'react'

import { atRest } from '../core/controls'
import {
  offStockKeys,
  opensInPanel,
  restick,
  settingsIndex,
} from './allSettings'
import styles from './AllSettingsSheet.module.css'
import { ControlRows } from './ControlGroup'
import { ALL_SLIDERS, MIX_STAGE, OFF_HINT, stageGroups } from './controls'
import { useControlReading } from './ControlsContext'
import { cx } from './cx'
import { PanelSheet } from './PanelSheet'
import { sameList } from './sameList'
import { Rack } from './Slider'

import type { GroupRows } from './allSettings'
import type { GeneratorsLive, Group } from './controls'

// Every control in the rig on one page, in signal order, under the stage and
// group the panel files it in. The panel opens one stage at a time and folds
// schematics and trims inside it; this sheet folds nothing, so a look spread
// across ten stages reads top to bottom. "Off stock only" narrows it to the
// rows the look has moved.
//
// The rows are the panel's own ControlSlider, so drag, reset, MIDI and the mod
// badge all work here. Each group's rows sit behind ControlRows, which React
// skips on a write unless the group's list of rows changes, so a drag costs the
// row it moves and the counts in two headings.
export function AllSettingsSheet(props: {
  offOnly: boolean
  onToggleOffOnly: () => void
  // The stages a jump can open, the same set the look menu takes. A stage with
  // nothing patched in is missing from it, and its controls act on nothing.
  openStages: ReadonlySet<string>
  // The panel lists a generator's group only while that generator runs, so a
  // jump to the group of an idle one would open nothing.
  generators: GeneratorsLive
  onOpenStage: (stage: string) => void
  onOpenGroup: (stage: string, group: string) => void
  onClose: () => void
}) {
  const now = useControlReading(offStockKeys)
  const [held, setHeld] = useState(now)
  const heldKeys = words(held)
  const keys = props.offOnly ? restick(heldKeys, words(now)) : null
  if (held !== now && keys !== heldKeys) setHeld(now)
  const index = settingsIndex(keys === null ? null : new Set(keys))
  const off = words(now).length
  return (
    <PanelSheet
      title="All settings"
      label="all settings"
      onClose={props.onClose}
      actions={
        <button
          className={cx(styles.only, props.offOnly && styles.onlyOn)}
          aria-pressed={props.offOnly}
          title={
            props.offOnly
              ? 'showing only the controls this look moves off stock — click to show every control'
              : 'show only the controls this look moves off stock'
          }
          onClick={props.onToggleOffOnly}
        >
          off stock only
        </button>
      }
    >
      <p className={styles.lead}>
        {off === 0
          ? `${ALL_SLIDERS.length} controls, all at stock.`
          : `${ALL_SLIDERS.length} controls, ${off} off stock.`}{' '}
        A group’s name opens it in the panel.
      </p>
      <div className={styles.list}>
        {index.length === 0 ? (
          <div className={styles.empty}>
            every control is at its default — move one and it turns up here
          </div>
        ) : (
          index.map(stage => (
            <section key={stage.name} className={styles.stage}>
              <StageHead
                name={stage.name}
                open={props.openStages.has(stage.name)}
                onOpen={() => props.onOpenStage(stage.name)}
              />
              {stage.groups.map(g => (
                <GroupBlock
                  key={g.group.name}
                  stage={stage.name}
                  group={g.group}
                  rows={sameList(g.rows)}
                  fine={sameList(g.fine)}
                  reach={opensInPanel(
                    stage.name,
                    g.group,
                    props.openStages,
                    props.generators,
                  )}
                  onOpen={props.onOpenGroup}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </PanelSheet>
  )
}

const words = (s: string): readonly string[] => (s === '' ? [] : s.split(' '))

function StageHead(props: { name: string; open: boolean; onOpen: () => void }) {
  const touched = useControlReading(c =>
    stageGroups(props.name).reduce(
      (n, g) => n + g.sliders.filter(s => !atRest(c[s.key], s.key)).length,
      0,
    ),
  )
  return (
    <h3 className={styles.stageHead}>
      {props.open ? (
        <button
          className={styles.stageName}
          title={`open ${props.name} in the panel`}
          onClick={props.onOpen}
        >
          {props.name}
        </button>
      ) : (
        <span className={styles.stageName}>{props.name}</span>
      )}
      {touched === 0 ? null : <span className={styles.dot}>• {touched}</span>}
      {props.open ? null : (
        <span
          className={styles.inert}
          title={
            props.name === MIX_STAGE
              ? OFF_HINT[MIX_STAGE]
              : `nothing is patched into ${props.name} yet, so these controls act on nothing`
          }
        >
          nothing patched in
        </span>
      )}
    </h3>
  )
}

function GroupBlock(props: {
  stage: string
  group: Group
  rows: GroupRows['rows']
  fine: GroupRows['fine']
  reach: boolean
  onOpen: (stage: string, group: string) => void
}) {
  const { group } = props
  const touched = useControlReading(
    c => group.sliders.filter(s => !atRest(c[s.key], s.key)).length,
  )
  return (
    <div className={styles.group}>
      <h4 className={styles.groupHead}>
        {props.reach ? (
          <button
            className={styles.groupName}
            title={`open ${group.name} in the ${props.stage} stage`}
            onClick={() => props.onOpen(props.stage, group.name)}
          >
            {group.name}
          </button>
        ) : (
          <span className={styles.groupName}>{group.name}</span>
        )}
        {touched === 0 ? null : <span className={styles.dot}>• {touched}</span>}
      </h4>
      <Rack sliders={group.sliders}>
        <ControlRows sliders={props.rows} />
        {props.fine.length === 0 ? null : (
          <>
            <div className={styles.fine}>fine tweaks</div>
            <ControlRows sliders={props.fine} />
          </>
        )}
      </Rack>
    </div>
  )
}
