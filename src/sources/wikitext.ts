// Words for line 21 about whatever a deck is showing: a passage out of the
// English Wikipedia article on the picture's subject.
//
// A Commons file names its subject through its categories, and a category that
// matches an article carries an interlanguage link to it ("Category:Neon signs"
// links en:Neon sign). The file's own global usage would be the direct route,
// but none of 24 sampled rolls was used in an English article, and most of
// them had a category one or two levels up that links one. Search on the
// categories and the file's name covers the rest, and a random article covers
// a deck with nothing on it.

import { pickOne } from '../core/rng'
import { archiveCaption } from './archive'
import { commonsCaption } from './commons'
import { isRecord, str } from './pool'

import type { Rand } from '../core/rng'
import type { PoolRef } from './pool'

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const WIKI_API = 'https://en.wikipedia.org/w/api.php'
export const WIKI_PAGE = 'https://en.wikipedia.org/wiki/'

// Enough for three or four sentences, which the encoder takes about eight
// seconds to send at 30 characters a second.
const PASSAGE_CHARS = 240

export interface Passage {
  article: string
  text: string
  // Whether the article was matched to the picture. False for a random one.
  matched: boolean
}

const api = (
  base: string,
  params: Record<string, string>,
): Promise<unknown> => {
  const search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    ...params,
  })
  return fetch(`${base}?${search.toString()}`).then(r => {
    if (!r.ok) throw new Error(`wikipedia ${r.status}`)
    return r.json() as Promise<unknown>
  })
}

const pagesOf = (body: unknown): Record<string, unknown>[] => {
  if (!isRecord(body) || !isRecord(body.query)) return []
  const pages = body.query.pages
  return Array.isArray(pages) ? pages.filter(isRecord) : []
}

// A category's English article, or null. A category that links only to
// another category ("en:Category:Amusement parks in Wales") names a topic too
// broad to be the picture's subject.
const articleOf = (page: Record<string, unknown>): string | null => {
  const links = page.langlinks
  if (!Array.isArray(links)) return null
  const first: unknown = links[0]
  if (!isRecord(first)) return null
  const title = str(first.title)
  return title === null || title.startsWith('Category:') ? null : title
}

interface Level {
  categories: string[]
  articles: string[]
}

const categoriesOf = async (titles: string[]): Promise<Level> => {
  const pages = pagesOf(
    await api(COMMONS_API, {
      titles: titles.slice(0, 50).join('|'),
      generator: 'categories',
      gclshow: '!hidden',
      gcllimit: 'max',
      prop: 'langlinks',
      lllang: 'en',
      lllimit: 'max',
    }),
  )
  const categories: string[] = []
  const articles: string[] = []
  for (const page of pages) {
    const title = str(page.title)
    if (title !== null) categories.push(title)
    const article = articleOf(page)
    if (article !== null) articles.push(article)
  }
  return { categories, articles }
}

// Words in a file name or a category that say nothing about the subject:
// archive accession numbers, camera counters, dates.
export const searchPhrase = (name: string): string =>
  name
    .replace(/^Category:/, '')
    .replace(/\bFortepan\s*\d+/gi, '')
    .replace(/\b(IMG|DSC|DSCN|DSCF|PXL|P)[_-]?\d+/gi, '')
    .replace(/\([^)]*\d{4,}[^)]*\)/g, '')
    .replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
      '',
    )
    .replace(/\b\d{2,}(s|th)?\b/g, '')
    .replace(/[_.,;:()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const searchArticle = async (phrase: string): Promise<string | null> => {
  if (phrase.length < 3) return null
  const body = await api(WIKI_API, {
    list: 'search',
    srsearch: phrase,
    srlimit: '1',
    srnamespace: '0',
    srinfo: '',
    srprop: '',
  })
  if (!isRecord(body) || !isRecord(body.query)) return null
  const hits = body.query.search
  if (!Array.isArray(hits)) return null
  const first: unknown = hits[0]
  return isRecord(first) ? str(first.title) : null
}

const randomArticle = async (): Promise<string> => {
  const body = await api(WIKI_API, {
    list: 'random',
    rnnamespace: '0',
    rnlimit: '1',
  })
  if (
    isRecord(body) &&
    isRecord(body.query) &&
    Array.isArray(body.query.random)
  ) {
    const first: unknown = body.query.random[0]
    const title = isRecord(first) ? str(first.title) : null
    if (title !== null) return title
  }
  throw new Error('wikipedia sent no random article')
}

// Candidate articles for a file, most specific first. Each level of the
// category tree is one request, and search is one per phrase, so this stops at
// the first step that finds anything.
export async function articlesAbout(ref: PoolRef): Promise<string[]> {
  if (ref.origin === 'archive')
    return [
      await searchArticle(searchPhrase(archiveCaption(ref.title))),
    ].filter((t): t is string => t !== null)

  const own = await categoriesOf([ref.title])
  if (own.articles.length > 0) return own.articles
  if (own.categories.length > 0) {
    const parents = await categoriesOf(own.categories)
    if (parents.articles.length > 0) return parents.articles
  }
  // Categories before the file's own name: Commons names categories in
  // English, and a file keeps whatever language its uploader wrote.
  const phrases = [...own.categories.slice(0, 2), commonsCaption(ref.title)]
  for (const name of phrases) {
    const found = await searchArticle(searchPhrase(name))
    if (found !== null) return [found]
  }
  return []
}

const extractOf = async (
  article: string,
): Promise<{ title: string; text: string }> => {
  const page = pagesOf(
    await api(WIKI_API, {
      titles: article,
      redirects: '1',
      prop: 'extracts',
      explaintext: '1',
      exsectionformat: 'plain',
    }),
  )[0]
  const text = page === undefined ? null : str(page.extract)
  if (page === undefined || text === null || text === '')
    throw new Error(`wikipedia has no text for ${article}`)
  return { title: str(page.title) ?? article, text }
}

// The caption encoder is seven-bit and turns anything else into a space, so
// "Kodály körönd" would arrive as "Kod ly k r nd". Accents come off, and the
// typographic punctuation Wikipedia uses goes back to its ASCII stand-in.
export const toAscii = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e\n]/g, '')
    .replace(/ {2,}/g, ' ')

// Where an article stops being prose. A plain-text extract gives each section
// heading a line of its own, and everything from the first of these on is
// lists of citations and links.
const BACK_MATTER =
  /^(See also|Notes|References|Citations|Sources|Bibliography|Further reading|External links)$/m

// Words that end in a full stop without ending a sentence: "St. Moritz",
// "Dr. Kovacs", "c. 1850", and an initial such as the "J." in "J. P. Morgan".
const ABBREVIATION =
  /(?:^|\s)(?:St|Mt|Mr|Mrs|Ms|Dr|Jr|Sr|Prof|Gen|Col|Lt|Capt|Rev|No|vs|c|ca|approx|[A-Z])\.$/

export const sentencesOf = (paragraph: string): string[] => {
  const out: string[] = []
  let from = 0
  for (const end of paragraph.matchAll(/[.!?]+["')\]]*(?=\s|$)/g)) {
    const to = end.index + end[0].length
    if (to < paragraph.length && ABBREVIATION.test(paragraph.slice(from, to)))
      continue
    out.push(paragraph.slice(from, to).trim())
    from = to
  }
  const rest = paragraph.slice(from).trim()
  if (rest !== '') out.push(rest)
  return out
}

const beforeBackMatter = (extract: string): string => {
  const at = extract.search(BACK_MATTER)
  return at === -1 ? extract : extract.slice(0, at)
}

// Paragraphs that read as prose. Section headings come through a plain-text
// extract as short lines with no full stop, which fail the test of holding a
// sentence of some length. Parentheticals go: in a lead they are
// pronunciations and birth dates, which read as noise at 30 characters a
// second.
export const proseParagraphs = (extract: string): string[] =>
  beforeBackMatter(extract)
    .split(/\n+/)
    .map(p => toAscii(p.replace(/\s*\([^()]*\)/g, '')).trim())
    .filter(p => p.length >= 80 && /[.!?]["')\]]*$/.test(p))

// A run of whole sentences from a random point in one random paragraph, cut
// before it passes `limit` characters. A sentence longer than the limit on its
// own is cut at a word.
export function passageFrom(
  extract: string,
  rand: Rand = Math.random,
  limit = PASSAGE_CHARS,
): string {
  const paragraph = pickOne(proseParagraphs(extract), rand)
  if (paragraph === null) return ''
  const sentences = sentencesOf(paragraph)
  const start = Math.floor(rand() * sentences.length)
  let out = ''
  for (const s of sentences.slice(start)) {
    const next = out === '' ? s : `${out} ${s}`
    if (next.length > limit) break
    out = next
  }
  if (out !== '') return out
  const first = sentences[start] ?? paragraph
  return `${first.slice(0, limit).replace(/\s+\S*$/, '')}...`
}

// A passage about what `ref` shows, or from a random article when `ref` is
// null or nothing on Wikipedia could be matched to it. `avoid` names the
// article the caption already came from, so asking again moves on when there
// is somewhere to move.
export async function passageAbout(
  ref: PoolRef | null,
  avoid = '',
  rand: Rand = Math.random,
): Promise<Passage> {
  const found = ref === null ? [] : await articlesAbout(ref)
  const fresh = found.filter(a => a !== avoid)
  const matched = pickOne(fresh.length > 0 ? fresh : found, rand)
  const { title, text } = await extractOf(matched ?? (await randomArticle()))
  const passage = passageFrom(text, rand)
  if (passage === '') throw new Error(`no prose in ${title}`)
  return { article: title, text: passage, matched: matched !== null }
}
