---
title: A more realistic scrambled channel
date: 2026-10-15
summary:
  We reworked the scrambled channel preset so the picture tears like a premium
  channel with no decoder, and the colour floods, bands and drops out.
image: /blog/scramble-catalogue.webp
imageAlt:
  A 1984 swimwear catalogue cover through the scrambled channel. The model and
  the grid of swimsuit photos beside her are torn into wavy slabs, with her arms
  acid green, her face violet and her legs magenta.
look: '#preset=scrambledChannel&set=scramble:0.7,scrambleMode:0,chromaGain:1.8&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg'
---

We rebuilt the scrambled channel preset so it looks like a real premium channel
with no decoder! Try it:
[scrambled channel](/app/#preset=scrambledChannel&set=scramble:0.7,scrambleMode:0,chromaGain:1.8&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

![A 1980 swimwear model in a zebra-print swimsuit and a white cape, arms spread against wood panelling, clean apart from noise and a soft cast.](/blog/scramble-before.webp)

Before: the TV found its timing marks again, so the picture only washed out.

![The same model with the cape torn into wavy slabs, the cape pink, the wall behind her bright green and a band of red across her legs.](/blog/scramble-colour-loops.webp)

After: the picture tears and the colour comes in bands.

![Three seconds of the 1984 catalogue cover through the scrambled channel. The torn shape of the model holds still while her face, arms and legs cycle through green, violet, magenta and yellow, and bands of colour drop out and come back across the frame.](https://myloveydove.com/videoskillet/blog/scramble-chroma-chaos.webp)

## A turbo version

We also made a rougher one. On real scrambled channels the picture slides
sideways harder than on our preset above, so we built
[turbo sync loss](/app/#preset=turboSyncLoss&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
to match them. We made the TV's line oscillator, the clock that starts each
line, drift a few tens of hertz either side of the line rate, loosened the
horizontal hold, the knob that stops the picture sliding sideways, and slowed
the vertical oscillator, which starts each frame, to 58 Hz, so the picture
slides sideways and wraps around the edge.

![The 1984 catalogue cover with bands of the picture slid sideways and wrapped round the edge. The grid of swimsuit photos is torn into wavy columns, and the colour is flooded pink, green and violet.](/blog/scramble-turbo-sync-loss.webp)

## Why the colour looks right

In our first tries we added faults straight to the colour, and they looked fake.
The real cable scramblers left the colour alone and only weakened the sync, so
we did the same, and the colour went wrong by itself. Without sync, the TV looks
for its colour reference, the burst, in the wrong part of each line. Its colour
gain and hue circuits, the ACC and the colour PLL, average the burst over 30 and
40 lines, so one bad reading shifts the colour of a whole band. We let the TV's
colour crystal drift slowly, and that slides the bands down the screen.

## Update, 1 November 2026

We made the preset even more faithful. We simulated the gate that General
Instrument and Jerrold built into cable head-ends, the equipment that sends the
channels down the cable. It turned the broadcast signal down 6 dB in the gap
between lines. That gap shows up as a grey bar, and the TV turns the colour up
to make up for the weakened burst, so the colour floods. The links above still
open the version this post describes, and you can
[open the new one](/app/#preset=scrambledChannel&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

## Update, 11 November 2026

We've since made more scramblers:
[Oak Sigma and VideoCipher II](/blog/oak-sigma-and-videocipher/) and
[the scrambled channel in a camera loop](/blog/scrambled-channel-in-a-loop/).

_Photos from Wikimedia Commons under CC BY-SA 3.0, and the stills here are under
the same licence: LIZ fashion's
[1984 catalogue cover](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
(top and animation), and
[Tami Ben Ami in Gottex](<https://commons.wikimedia.org/wiki/File:Flickr_-_Government_Press_Office_(GPO)_-_Tami_Ben_Ami_in_a_Gottex_Bathing_Suit.jpg>)
by Yaakov Saar for the Israeli Government Press Office, 1980._
