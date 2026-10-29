// CROSS_REPO_SYNC_FILE(image-size)
import { imageMetadata } from 'astro/assets/utils'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const bytesOf = async (path: string) =>
  /^https?:/.test(path)
    ? new Uint8Array(await (await fetch(path)).arrayBuffer())
    : readFile(join(process.cwd(), 'public', path))

// The width and height of an image under `public/`, or at a URL for an
// animation on the bucket, so an <img> reserves its box before the file
// arrives.
export const imageSize = async (
  path: string,
): Promise<{ width: number; height: number }> => {
  const { width, height } = await imageMetadata(await bytesOf(path), path)
  return { width, height }
}
