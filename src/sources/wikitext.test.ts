import { describe, expect, test } from 'vitest'

import {
  passageFrom,
  proseParagraphs,
  searchPhrase,
  sentencesOf,
  toAscii,
} from './wikitext'

const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('searchPhrase', () => {
  test('drops accession numbers, counters and dates', () => {
    expect(
      searchPhrase("Háttérben a Badrutt's Palace Hotel. Fortepan 28713"),
    ).toBe("Háttérben a Badrutt's Palace Hotel")
    expect(searchPhrase('Category:September 2016 in Rome')).toBe('in Rome')
    expect(searchPhrase('Eldorado Hotel Casino, Reno (169701837)')).toBe(
      'Eldorado Hotel Casino Reno',
    )
    expect(searchPhrase('IMG_2041')).toBe('')
  })
})

describe('toAscii', () => {
  test('keeps accented letters as their base letter', () => {
    expect(toAscii('Kodály körönd')).toBe('Kodaly korond')
  })

  test('maps typographic punctuation to ASCII', () => {
    expect(toAscii('“Bonanza” – the world’s largest…')).toBe(
      '"Bonanza" - the world\'s largest...',
    )
  })

  test('drops what has no ASCII stand-in', () => {
    expect(toAscii('[abɛrˈəstʊɨθ]')).toBe('[abrst]')
  })
})

const EXTRACT = `Neon sign

In the signage industry, neon signs are electric signs lighted by long luminous gas-discharge tubes that contain rarefied neon or other gases. They are the most common use for neon lighting.

History

The first neon sign was demonstrated by Georges Claude at the Paris Motor Show in 1910. It was lit by two tubes of red light. Claude went on to sell signs through his company. Neon became popular in the United States in the 1920s.`

describe('sentencesOf', () => {
  test('does not end a sentence at an abbreviation or an initial', () => {
    expect(
      sentencesOf(
        'Johannes Badrutt bought a guesthouse in St. Moritz in 1856. J. P. Morgan stayed there c. 1900! It closed.',
      ),
    ).toEqual([
      'Johannes Badrutt bought a guesthouse in St. Moritz in 1856.',
      'J. P. Morgan stayed there c. 1900!',
      'It closed.',
    ])
  })
})

describe('proseParagraphs', () => {
  test('stops at the references', () => {
    const paras = proseParagraphs(
      `${EXTRACT}\n\nReferences\n\nRetrieved 2021-10-11. Article about neon signage's flowering and decline in Warsaw and Poland.`,
    )
    expect(paras).toHaveLength(2)
  })

  test('drops parentheticals', () => {
    expect(
      proseParagraphs(
        'Aberystwyth (Welsh: [abɛrˈəstʊɨθ]) is a market town and community in Ceredigion, on the west coast of Wales.',
      ),
    ).toEqual([
      'Aberystwyth is a market town and community in Ceredigion, on the west coast of Wales.',
    ])
  })

  test('skips headings and keeps paragraphs that end a sentence', () => {
    const paras = proseParagraphs(EXTRACT)
    expect(paras).toHaveLength(2)
    expect(paras[1].startsWith('The first neon sign')).toBe(true)
  })
})

describe('passageFrom', () => {
  test('takes whole sentences from a random start within the limit', () => {
    // second paragraph, second sentence
    const text = passageFrom(EXTRACT, seq(0.9, 0.3), 90)
    expect(text).toBe(
      'It was lit by two tubes of red light. Claude went on to sell signs through his company.',
    )
  })

  test('cuts a sentence longer than the limit at a word', () => {
    const text = passageFrom(EXTRACT, seq(0, 0), 40)
    expect(text).toBe('In the signage industry, neon signs are...')
  })

  test('is empty when nothing reads as prose', () => {
    expect(passageFrom('Heading\n\nAnother heading')).toBe('')
  })
})
