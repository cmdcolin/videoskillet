import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { CommandPalette } from './CommandPalette'

// The palette is an ordinary region, so nothing moves focus into it except the
// box asking for it: ⌘K was aimed at the box.

afterEach(cleanup)

test('the search box has focus as the palette opens', () => {
  render(
    <CommandPalette
      controls={DEFAULT_CONTROLS}
      actions={[]}
      onApplyPreset={() => {}}
      onMixStart={() => {}}
      onWriteControl={() => {}}
      onRevealControl={() => {}}
      onClose={() => {}}
    />,
  )
  expect(document.activeElement).toBe(
    screen.getByPlaceholderText('a preset, control, or action…'),
  )
})
