import { imageMetadata } from 'astro/assets/utils'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// The width and height of an image under `public/`, so an <img> reserves its
// box before the file arrives.
export const imageSize = async (
  path: string,
): Promise<{ width: number; height: number }> => {
  const { width, height } = await imageMetadata(
    await readFile(join(process.cwd(), 'public', path)),
    path,
  )
  return { width, height }
}
