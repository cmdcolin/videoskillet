---
title: A more realistic scrambled channel
date: 2026-10-15
summary:
  The scrambled channel preset now tears like an undecoded premium channel on a
  real set, and its colour floods, bands and drops out while the picture holds.
image: /blog/scramble-catalogue.webp
imageAlt:
  A 1984 swimwear catalogue cover through the scrambled channel. The model and
  the grid of swimsuit photos beside her are torn into wavy slabs, with her arms
  acid green, her face violet and her legs magenta.
look: '#preset=scrambledChannel&set=scramble:0.7,scrambleMode:0,chromaGain:1.8&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg'
---

Try it:
[scrambled channel](/app/#preset=scrambledChannel&set=scramble:0.7,scrambleMode:0,chromaGain:1.8&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

![A 1980 swimwear model in a zebra-print swimsuit and a white cape, arms spread against wood panelling, clean apart from noise and a soft cast.](/blog/scramble-before.webp)

Before: the TV found its timing marks again, and the picture only washed out.

![The same model with the cape torn into wavy slabs, the cape pink, the wall behind her bright green and a band of red across her legs.](/blog/scramble-colour-loops.webp)

After: the picture tears, and the colour comes in bands.

![Three seconds of the 1984 catalogue cover through the scrambled channel. The torn shape of the model holds still while her face, arms and legs cycle through green, violet, magenta and yellow, and bands of colour drop out and come back across the frame.](https://myloveydove.com/videoskillet/blog/scramble-chroma-chaos.webp)

## A turbo version

Footage of real scrambled channels on YouTube loses sync far harder, with whole
bands of the picture sliding across the screen and wrapping round the edge. The
[turbo sync loss](/app/#preset=turboSyncLoss&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
preset swings the line oscillator's frequency a few tens of hertz either side of
the line rate, and loosens the horizontal and vertical hold.

![The 1984 catalogue cover with bands of the picture slid sideways and wrapped round the edge. The grid of swimsuit photos is torn into wavy columns, and the colour is flooded pink, green and violet.](/blog/scramble-turbo-sync-loss.webp)

## What made the colour look right

Cable companies scrambled a channel by removing the timing marks that tell a TV
where each line starts, and left the colour alone. Our first attempts added
faults to the colour directly, and they looked fake.

Each line starts with a short colour reference, which the TV finds by the timing
marks. Without the marks the TV often reads the wrong spot, and because it
averages the reference over dozens of lines, one wrong reading tints a whole
band. Once the simulated TV could make that mistake, the bands appeared with no
code written to draw them. A slow wander in the TV's colour timing keeps them
moving.

## Update, 1 November 2026

The preset now models the RF gate that GI and Jerrold head-ends used. The
carrier drops 6 dB through every horizontal blanking interval, so the blanking
shows as a grey bar and the colour floods to match the weakened burst. The links
above open the version this post describes;
[open the new one](/app/#preset=scrambledChannel&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

## Update, 11 November 2026

[Oak Sigma and VideoCipher II](/blog/oak-sigma-and-videocipher/) covers two more
scrambling systems, and
[The scrambled channel in a camera loop](/blog/scrambled-channel-in-a-loop/)
covers presets that put the scrambler in a camera loop or on a tape.

_Photos from Wikimedia Commons under CC BY-SA 3.0, and the stills here are under
the same licence: LIZ fashion's
[1984 catalogue cover](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
(top and animation), and
[Tami Ben Ami in Gottex](<https://commons.wikimedia.org/wiki/File:Flickr_-_Government_Press_Office_(GPO)_-_Tami_Ben_Ami_in_a_Gottex_Bathing_Suit.jpg>)
by Yaakov Saar for the Israeli Government Press Office, 1980._
