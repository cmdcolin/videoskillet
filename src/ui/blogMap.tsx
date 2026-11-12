import { renderToStaticMarkup } from 'react-dom/server'
import { arrowhead } from 'skillet-shared/wire-route'

import { BOX_H, boxWidth, chainLayout, H, HEAD, MID_Y, W } from './chainLayout'
import { ChainMap } from './ChainMap'
import styles from './ChainMap.module.css'
import { cx } from './cx'
import { NO_FILTER } from './filter'
import { panelChain } from './panelChain'

export interface InsetChip {
  name: string
  sub?: string
  off?: boolean
}

export interface BlogMap {
  stage: string
  title: string
  chips: InsetChip[]
}

const PANEL_TOP = H + 10
const PANEL_H = 64
const CHIP_Y = PANEL_TOP + 38
const CHIP_H = 30
const SIDE = 4
const LEAD = 14

const shut = <T extends object>(n: T) => ({ ...n, opens: false })

function inset(map: BlogMap, stageX: number) {
  const { chips } = map
  const widths = chips.map(c =>
    Math.max(boxWidth(c.name), (c.sub ?? '').length * 4.6 + 10),
  )
  const span = W - 2 * SIDE - 2 * LEAD
  const gap = (span - widths.reduce((n, w) => n + w, 0)) / (chips.length - 1)
  const lefts = widths.map(
    (_, i) =>
      SIDE + LEAD + widths.slice(0, i).reduce((n, w) => n + w, 0) + gap * i,
  )
  const runs = [
    [SIDE, lefts[0]!],
    ...lefts
      .slice(0, -1)
      .map((x, i) => [x + widths[i]!, lefts[i + 1]!] as const),
    [lefts.at(-1)! + widths.at(-1)!, W - SIDE],
  ]
  return (
    <g>
      <line
        className={styles.mapWire}
        x1={stageX}
        y1={MID_Y + BOX_H / 2}
        x2={stageX}
        y2={PANEL_TOP}
        strokeDasharray="2 2"
      />
      <rect
        className={styles.mapWire}
        x={SIDE / 2}
        y={PANEL_TOP}
        width={W - SIDE}
        height={PANEL_H}
        rx={6}
        strokeDasharray="2 2"
      />
      <text
        className={styles.mapLoopLabel}
        x={SIDE + 6}
        y={PANEL_TOP + 11}
        dominantBaseline="central"
      >
        {map.title}
      </text>
      {runs.map(([x0, x1]) => (
        <g key={x0}>
          <line
            className={styles.mapWire}
            x1={x0}
            y1={CHIP_Y}
            x2={x1 - HEAD}
            y2={CHIP_Y}
          />
          <path
            className={styles.mapArrow}
            d={arrowhead(
              [
                [x0, CHIP_Y],
                [x1, CHIP_Y],
              ],
              HEAD,
              HEAD,
            )}
          />
        </g>
      ))}
      {chips.map((chip, i) => {
        const x = lefts[i]! + widths[i]! / 2
        return (
          <g
            key={chip.name}
            className={cx(
              styles.mapNode,
              chip.off === true && styles.mapNodeOff,
            )}
          >
            <rect
              className={styles.mapBox}
              x={lefts[i]}
              y={CHIP_Y - CHIP_H / 2}
              width={widths[i]}
              height={CHIP_H}
              rx={3}
            />
            <text
              className={styles.mapLabel}
              x={x}
              y={chip.sub === undefined ? CHIP_Y : CHIP_Y - 6}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {chip.name}
            </text>
            {chip.sub === undefined ? null : (
              <text
                className={styles.mapSub}
                x={x}
                y={CHIP_Y + 7}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {chip.sub}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

export function blogMapMarkup(map: BlogMap) {
  const chain = panelChain({
    offStock: new Set(),
    filter: NO_FILTER,
    isRouted: () => false,
    bOn: true,
    soundOn: true,
    patched: {},
    generators: { noise: false, synth: false },
    onOpenGroup: () => {},
    free: [],
  })
  const branches = chain.branches
    .map(shut)
    .flatMap(n => (n.free === true ? [] : [n]))
  const names = chain.nodes.map(n => n.name)
  const stage = chainLayout(names, branches).boxes[names.indexOf(map.stage)]
  if (stage === undefined) throw new Error(`no stage named ${map.stage}`)
  const trunk = renderToStaticMarkup(
    <ChainMap
      stages={chain.nodes.map(shut)}
      branches={branches}
      loops={chain.loops.map(shut)}
      open={null}
      folds={false}
      live={{ camera: false, mixer: false }}
      onOpen={() => {}}
    />,
  ).replace(/^<svg[^>]*>|<\/svg>$/g, '')
  const panel = renderToStaticMarkup(inset(map, stage.x))
  return `<svg class="${styles.map}" viewBox="0 0 ${W} ${PANEL_TOP + PANEL_H + 2}">${trunk}${panel}</svg>`
}
