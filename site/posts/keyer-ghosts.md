---
title: Chroma keying with ghosts
date: 2026-11-02
summary:
  The chroma keyer can fill the hole it cuts with its own earlier output, so a
  skeleton dancing in front of the green screen leaves a trail of fading copies
  in an abandoned ballroom.
image: https://myloveydove.com/videoskillet/blog/keyer-fade-skeleton.webp
imageAlt:
  A skeleton dancing beside a grand piano in an abandoned ballroom, trailed by a
  row of fainter copies of itself.
look: '#iurl=https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg/1280px-Abandoned_grand_piano_-_Abandoned_Ballroom_%286%29.jpg&vurlb=https://myloveydove.com/videoskillet/sources/creatures-for-chroma-key-death.webm&set=chromaGain:1.3,crtSat:1.2,bGain:1,bGenlock:1,bKey:1,bKeyAcceptDeg:45,bKeyClip:0.05,bKeySpill:0.6,bKeyFill:2,cfbHold:3,bKeyFillMixA:0.15'
---

The keyer cuts the skeleton out of its green screen and sets it over the
ballroom in program A. With **fill** set to **loop bus**, the hole it cuts shows
the frame store, which holds the keyer's own output from a few frames earlier.
Each recording already contains the copies from the ones before, so the skeleton
leaves a trail of itself as it dances.

**Strobe hold** at 3 records every fourth frame, which keeps the copies apart.
**Program A in fill** at 0.15 mixes a little of the room into each recording, so
every copy fades back into the ballroom.

_Footage: the skeleton is from
[Creatures For Chroma Key](https://archive.org/details/EvaVikstromCreaturesForChromaKey)
by Eva Vikström, under CC BY 3.0. The ballroom is
[Abandoned grand piano](<https://commons.wikimedia.org/wiki/File:Abandoned_grand_piano_-_Abandoned_Ballroom_(6).jpg>)
by Jan Bommes, under CC BY 2.0._
