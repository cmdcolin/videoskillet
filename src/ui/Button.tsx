import { cx } from './cx'
import ui from './ui.module.css'

import type { ButtonHTMLAttributes } from 'react'

// The quiet outlined button that the masthead and the look bar wear. `icon`
// squares it for a single glyph.
export function Button({
  variant = 'outline',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'outline' | 'icon' }) {
  return (
    <button
      {...rest}
      className={cx(variant === 'icon' ? ui.chromeBtn : ui.outline, className)}
    />
  )
}
