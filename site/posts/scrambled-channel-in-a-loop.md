---
title: The scrambled channel in a camera loop
date: 2026-11-11
summary:
  A camera pointed at a scrambled channel lays the picture down as a row of
  positive and negative copies, and a taped copy of the channel adds noise and
  dropouts to the tearing.
image: /blog/scramble-paper-dolls-film.webp
imageAlt:
  Two faces repeated across the frame as overlapping copies, alternately pale
  blue and red. A white band and a black bar run down the right edge.
look: '#preset=paperDolls&vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/0/02/ARTIFACTS_-_Fashion_Film.webm/ARTIFACTS_-_Fashion_Film.webm.480p.vp9.webm'
---

Try it:
[paper dolls](/app/#preset=paperDolls&vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/0/02/ARTIFACTS_-_Fashion_Film.webm/ARTIFACTS_-_Fashion_Film.webm.480p.vp9.webm).
The two faces in the picture above are about 35 seconds into the film.

Two presets point a camera at a set showing the
[scrambled channel](/blog/better-scramble-channel/) and mix its output back into
the signal ahead of the scrambler. The third plays the channel from a dubbed
tape.

## Paper dolls

Zenith's SSAVI scrambler inverted the video on a keyed schedule. The camera
output is mixed back at 0.7, and the sync suppression is light enough that the
set keeps lock. Each pass through the loop adds a horizontally offset copy, and
the copy is inverted while the key is set.

![The model from a 1984 swimwear catalogue repeated across the frame as overlapping copies, some blue and some orange, beside the grid of swimsuit photos in the same two colours. A white band and a black bar run down the right edge.](/blog/scramble-paper-dolls.webp)

The picture above is the same preset over
[a still photo](/app/#preset=paperDolls&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

## Marbled channel

[Marbled channel](/app/#preset=marbledChannel&vurl=https://upload.wikimedia.org/wikipedia/commons/transcoded/0/02/ARTIFACTS_-_Fashion_Film.webm/ARTIFACTS_-_Fashion_Film.webm.480p.vp9.webm)
mixes the camera back at 0.28 over the full scrambled channel. The set loses
lock on every pass, so the tearing compounds.

![Two faces at the top right of a picture torn into flowing ribbons of green, violet, blue and orange. Black, grey and white bands wind down the left of the frame.](/blog/scramble-marbled-film.webp)

## A taped copy

[Bootleg fight](/app/#preset=bootlegFight&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
is a second-generation VHS dub of the scrambled channel, with tape noise,
dropouts, colour-under jitter and time-base wow on top.

_The film is
[ARTIFACTS – Fashion Film](https://commons.wikimedia.org/wiki/File:ARTIFACTS_-_Fashion_Film.webm)
by Tiffany Frances, from Wikimedia Commons under CC BY 3.0. The catalogue cover
is LIZ fashion's
[1984 catalogue cover](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg),
from Wikimedia Commons under CC BY-SA 3.0, and the stills of it here are under
the same licence._
