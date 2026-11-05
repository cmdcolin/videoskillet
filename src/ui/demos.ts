import demos from '../../demos.json'
import { publicUrl } from '../publicUrl'

export interface Demo {
  name: string
  says: string
  link: string
  still: string
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

// The gallery's demos, the ones picked for the reel first.
export const DEMOS: readonly Demo[] = demos
  .filter(d => d.gallery)
  .toSorted((a, b) => Number(b.showcase) - Number(a.showcase))
  .map(d => ({
    name: d.name,
    says: d.says,
    link: d.query,
    still: publicUrl(`demos/${slug(d.name)}.webp`),
  }))
