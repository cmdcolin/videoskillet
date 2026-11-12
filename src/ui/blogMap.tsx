import { renderToStaticMarkup } from 'react-dom/server'

import { atRest, CONTROL_KEYS, DEFAULT_CONTROLS } from '../core/controls'
import { SOURCE_DESC } from '../sources/modes'
import { ChainMap } from './ChainMap'
import {
  generatorsLive,
  PICKER_STAGES,
  SOURCE_A_STAGE,
  SOURCE_B_STAGE,
} from './controls'
import { NO_FILTER } from './filter'
import { panelChain } from './panelChain'
import { parseSessionParams, urlName } from './urlParams'

import type { SourceBMode, SourceMode } from '../sources/modes'

const caption = (
  url: string | null,
  mode: SourceMode | SourceBMode,
): string | undefined =>
  url !== null
    ? urlName(url)
    : mode === 'none'
      ? undefined
      : SOURCE_DESC[mode].split(' — ')[0]

const opensOn = <T extends { name: string; off?: boolean }>(n: T) => ({
  ...n,
  opens: n.off !== true || PICKER_STAGES.has(n.name),
})

export function blogMapMarkup(look: string) {
  const params = parseSessionParams(look.replace(/^#/, ''))
  const controls = { ...DEFAULT_CONTROLS, ...params.controls }
  const bUrl = params.iurlb ?? params.vurlb ?? params.ytb
  const a = params.src ?? 'bars'
  const b = params.srcb ?? (bUrl === null ? 'none' : 'url')
  const chain = panelChain({
    offStock: new Set(CONTROL_KEYS.filter(k => !atRest(controls[k], k))),
    filter: NO_FILTER,
    isRouted: () => false,
    bOn: b !== 'none',
    soundOn: false,
    patched: {
      [SOURCE_A_STAGE]: caption(params.iurl ?? params.vurl ?? params.yt, a),
      [SOURCE_B_STAGE]: caption(bUrl, b),
    },
    generators: generatorsLive(a, b, controls),
    onOpenGroup: () => {},
    free: [],
  })
  return renderToStaticMarkup(
    <ChainMap
      stages={chain.nodes.map(opensOn)}
      branches={chain.branches
        .map(opensOn)
        .flatMap(n => (n.free === true ? [] : [n]))}
      loops={chain.loops.map(opensOn)}
      open={null}
      folds={false}
      live={{ camera: controls.fbMix > 0, mixer: controls.cfbMix > 0 }}
      onOpen={() => {}}
    />,
  )
}
