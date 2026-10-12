---
title: Closed captions as data, and pins held on font ROMs
date: 2026-08-29
summary:
  The set decodes line 21 into characters that noise can misspell, a character
  generator keys a lower third onto the program, and both fonts can be bent at
  the ROM.
image: /demos/my-lord.webp
imageAlt:
  A caption box of repeated garbled letters over a smeared red, blue and green
  feedback picture.
look: '#src=cat&set=chromaGain:2.62,cc:1,ccBox:0.85,ccRomAddr:1,ccRomData:-3,cgMix:0.48,cgY:0.28,cgScale:2.5,cgRomAddr:5,noiseIre:5.9,rfMistuneMHz:0.39,fbMix:0.61,fbZoom:1.028,fbGain:1.096,fbBlack:0.045,cfbMix:1,cfbGain:-1.22,cfbDelayUs:2.357,cfbLines:60,cfbKey:1,cfbKeyLevel:53,cfbKeySoft:10,cfbKeyExt:1,cfbRing:1,cfbGenlock:1,phosphor:0.1603,timeScale:0.45&mod='
---

Version 0.32.0 put text on the screen in two ways, and each one fails
differently. The same sentence travels down both paths, which makes the
difference easy to see.

## Line 21 is data

The encoder stamps real characters on line 21, and the receiver has a caption
decoder that slices the line off the composite signal after the channel has
finished with it. Damage therefore arrives as wrong words. Noise, a narrow
channel and generation loss drop characters and substitute others, and a parity
failure draws the solid block a real decoder draws.

The decoder paints its page on the set's own raster. The picture can roll, tear
and spin hue underneath a caption that holds still, and the caption still bends
with the tube and blooms with the phosphor, because those stages come later. The
[service position](/app/#preset=servicePosition&src=clip-haunted-house) preset
shows it with the picture rolling behind a caption that stays put.

## A chyron is picture

A character generator at the switcher keys a lower third onto the program bus.
This caption is picture, so it gets torn and smeared and is never misspelled. A
keyer uses two wires: the fill carries the characters as video, and the key
carries their matte. Trimming the timing between the two puts the box's own
black through one side of every stem and lets the program show through the
other.

## Bending the font ROM

The caption decoder and the character generator each read their glyphs from a
font ROM, and you can hold a pin on either one. A held pin is deterministic, so
the same text comes out wrong the same way every time. The address bus carries
the character code on its high lines and the row inside the cell on its low
ones. One knob therefore sweeps from every glyph growing a seam to the whole
font being swapped for its neighbour in the chip. Holding a data line stripes
one column of dots down every character.

![Two cartoon skeletons with a lower third that has sheared into a block of scrambled glyphs, and a caption above it reduced to scattered dots.](/blog/scrambled-character-rom.webp)

Version 0.41.0 added four more bends: a cell-height strap, a crossed pair of
address lines, decayed cells, and a held line on the page counter. The strap is
the loudest. The address walks out of the cell the raster is drawing, so each
scan line comes from a different character and the text shears diagonally
through the whole font. Counters that slip are the one fault on these chips that
moves, and they make the font crawl up through its cells.

The part is a 2 KiB EPROM holding a 1152-byte font, so 896 bytes were never
programmed. A high line held far enough reads that blank space and draws solid
characters. Try
[scrambled character ROM](/app/#preset=scrambledCharacterRom&src=clip-haunted-house)
and [bent font ROM](/app/#preset=bentFontRom&src=clip-haunted-house), or open
the image at the top as the look it came from.
