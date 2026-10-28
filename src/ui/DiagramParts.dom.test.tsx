import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import styles from './Diagram.module.css'
import { Chain } from './DiagramParts'

afterEach(cleanup)

const looks = (stages: { live: boolean; alarm?: boolean }[]) => {
  const { container } = render(
    <svg>
      <Chain
        arrow="a"
        y={0}
        from={0}
        to={100}
        stages={stages.map((s, i) => ({ ...s, at: { x: 10 + i * 20, w: 10 } }))}
      />
    </svg>,
  )
  return [...container.querySelectorAll('path')].map(p =>
    p.getAttribute('class'),
  )
}

describe('Chain', () => {
  test('lights every wire after a live stage', () => {
    expect(looks([{ live: false }, { live: true }, { live: false }])).toEqual([
      styles.wire,
      styles.wire,
      styles.wireOn,
      styles.wireOn,
    ])
  })

  test('carries an alarm down the rest of the chain', () => {
    expect(
      looks([{ live: true }, { live: true, alarm: true }, { live: false }]),
    ).toEqual([styles.wire, styles.wireOn, styles.wireAlarm, styles.wireAlarm])
  })
})
