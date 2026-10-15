---
title: A more realistic scrambled channel, just like you remember it from childhood
date: 2026-10-15
summary:
  The scrambled channel preset now tears like an undecoded premium channel on a
  real set, and its colour floods, bands and drops out while the picture holds.
image: /blog/scramble-catalogue.webp
imageAlt:
  A 1984 swimwear catalogue cover through the scrambled channel. The model and
  the grid of swimsuit photos beside her are torn into wavy slabs, with her arms
  acid green, her face violet and her legs magenta.
look: '#preset=scrambledChannel&src=clip-haunted-house'
---

_Above: the cover of LIZ fashion's 1984 swimwear catalogue
([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg),
CC BY-SA 3.0). Below: the model Tami Ben Ami in a Gottex swimsuit, photographed
by Yaakov Saar for the Israeli Government Press Office in 1980
([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Flickr_-_Government_Press_Office_(GPO)_-_Tami_Ben_Ami_in_a_Gottex_Bathing_Suit.jpg),
CC BY-SA 3.0). Both are cropped and run through the presets this post
describes, and the stills are under the same licence._

Photographs of real undecoded premium channels show a picture that roughly
holds while its edges tear, and colour that floods across it in bands. The
[scrambled channel](/app/#preset=scrambledChannel&src=clip-haunted-house) preset
used to show a washed-out but steady picture. It now tears and floods the way
the photographs do, and the colour keeps changing while the picture stays put.
Each part of the look comes from a fault in the receiver.

## Deeper sync suppression

![A 1980 swimwear model in a zebra-print swimsuit and a white cape, arms spread against wood panelling, clean apart from noise and a soft cast.](/blog/scramble-before.webp)

A head-end scrambler lifts the sync tips toward blanking, so a set without a
decoder box has no line start to slice. The old preset suppressed sync to 55%
depth. At that depth the set's AGC turned the gain up until the shallow tips
crossed the separator's slicing level again, so the set relocked and the picture
only washed out. The preset now suppresses to 70%. The line oscillator drifts,
the blanking bar wanders into the picture, and the edges tear.

## Slow colour loops

![The same model with the cape torn into wavy slabs, the cape pink, the wall behind her bright green and a band of red across her legs.](/blog/scramble-colour-loops.webp)

A receiver keys its burst gate from its own flyback. Once the line oscillator
has lost the line, the gate opens on the colour burst on some lines and on the
picture on others. The preset gives the set slow colour loops: the burst phase
lock averages over 40 lines, the chroma gain control over 30, and the colour
killer is set low. The phase lock holds whatever hue it averaged across a band
of lines, so the picture fills with bands of hue. The gain control averages
good bursts together with missed ones, which keeps the gain high and the colour
saturated.

The set's output stage also clips each gun separately now. The burst sits below
black level, and a stage that fits the colour into gamut as a whole drew it
black. With each gun clipped on its own, the burst in the drifting blanking bar
shows as a stripe of colour.

## Chroma chaos

![Four frames of the same model over two seconds. The tears are the same in all four, and the wall goes from violet to green to blue while her belt turns orange, then blue.](/blog/scramble-chroma-chaos.webp)

Two more faults keep the colour moving while the picture holds still. The
colour crystal is pulled 60 Hz off frequency, and the burst lock is weak because
the gate keeps missing the burst. The phase error grows by about two turns of
hue over each frame, which lays rainbow bands down the screen. The fine tuning
drifts either side of the channel. On one side the burst sinks under the colour
killer and colour drops out in bands. On the other side the sound carrier beats
against the chroma.

The crystal and the tuner drift along a Lorenz attractor, which never repeats.
The bands keep changing count and direction and never settle into a regular
roll. A drift on the line oscillator lost sync within seconds, so the preset
leaves the oscillator alone.

The crystal error rotates the chroma already in the signal, so the effect needs
a colour source. A black-and-white photograph through the same preset stays
grey apart from the noise.

The slow colour loops and per-gun clipping are also in
[ssavi](/app/#preset=ssavi&src=clip-haunted-house),
[supply chaos](/app/#preset=supplyChaos&src=clip-haunted-house) and
[full collapse](/app/#preset=fullCollapse&src=clip-haunted-house), which now
tear more slowly and ring less than before.
