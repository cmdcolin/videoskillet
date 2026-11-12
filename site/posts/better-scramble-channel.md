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

Before: the TV still found the sync pulses, so the picture only washed out.

![The same model with the cape torn into wavy slabs, the cape pink, the wall behind her bright green and a band of red across her legs.](/blog/scramble-colour-loops.webp)

After: the picture tears and the colour comes in bands.

![Three seconds of the 1984 catalogue cover through the scrambled channel. The torn shape of the model holds still while her face, arms and legs cycle through green, violet, magenta and yellow, and bands of colour drop out and come back across the frame.](https://myloveydove.com/videoskillet/blog/scramble-chroma-chaos.webp)

## A turbo version

Real scrambled channels slide the picture sideways harder than our preset does,
so we also built
[turbo sync loss](/app/#preset=turboSyncLoss&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
to match them. We made the TV's line oscillator, the clock that starts each
line, drift a few tens of hertz either side of the line rate (15,734 lines a
second). We loosened the horizontal hold, the knob that stops the picture
sliding sideways, and slowed the vertical oscillator, which starts each frame,
to 58 Hz, so the picture wraps around the edge.

![The 1984 catalogue cover with bands of the picture slid sideways and wrapped round the edge. The grid of swimsuit photos is torn into wavy columns, and the colour is flooded pink, green and violet.](/blog/scramble-turbo-sync-loss.webp)

## Why we scramble in Channel

A premium channel's head-end scrambled the program after the studio had mixed
it. We put the scrambler in **Channel**, which holds the head-end and the cable
between the mixer and the TV's aerial socket. You'll find it as **sync
suppression** and **system** in the **Cable / Wiring** group. To scramble one
input before the mix, use **A sync suppression** in the **Feed A · deck** group
of Source A.

A scrambler works on the sync pulses, the short dips at the start of every line
that tell the TV where the line begins. The **Receiver** is the TV, and nothing
in it knows the channel is scrambled. The tearing and the flooded colour come
from the TV hunting for pulses it can't find.

<figure>
<img src="/blog/scramble-map.svg" alt="The app's five signal-path stages in a row: Source A, Mix, Channel, Receiver and Screen. A note under Source A says the encoder turns the picture into a signal with sync pulses. A note under Mix says the studio mixes the program before the head-end. A note under Channel says the head-end scrambler in Cable / Wiring hides the pulses. A note under Receiver says the TV hunts for the pulses and tears the picture.">
<figcaption>Where each part of the scramble happens in the app's signal path.</figcaption>
</figure>

## Why the colour looks right

In our first tries we added faults straight to the colour, and they looked fake.
The real cable scramblers left the colour alone and only weakened the sync, so
we did the same, and the colour went wrong by itself. Without sync, the TV looks
for its colour reference, the
[burst](https://en.wikipedia.org/wiki/Color_burst), in the wrong part of each
line. Its colour gain circuit, the ACC (automatic colour control), averages the
burst over 30 lines, and its hue circuit, the colour
[PLL](https://en.wikipedia.org/wiki/Phase-locked_loop), averages it over 40, so
one bad reading shifts the colour of a whole band. We let the TV's
[colour crystal](https://en.wikipedia.org/wiki/Crystal_oscillator) (the quartz
that keeps its colour timing) drift slowly, and that slides the bands down the
screen.

## Update, 1 November 2026

We simulated the gate that
[General Instrument](https://en.wikipedia.org/wiki/General_Instrument) and
[Jerrold](https://en.wikipedia.org/wiki/Jerrold_Electronics) built into cable
[head-ends](https://en.wikipedia.org/wiki/Cable_television_headend), the
equipment that sends the channels down the cable. It turned the broadcast signal
down 6 dB (to half its strength) in the gap between lines. That gap shows up as
a grey bar, and the TV turns up the colour to make up for the weak burst until
it floods. The links above still open the version this post describes, and you
can
[open the new one](/app/#preset=scrambledChannel&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

## Update, 11 November 2026

We've since made more scramblers:
[Oak Sigma and VideoCipher II](/blog/oak-sigma-and-videocipher/).

_Photos from Wikimedia Commons under CC BY-SA 3.0, and the stills here are under
the same licence: LIZ fashion's
[1984 catalogue cover](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
(top and animation), and
[Tami Ben Ami in Gottex](<https://commons.wikimedia.org/wiki/File:Flickr_-_Government_Press_Office_(GPO)_-_Tami_Ben_Ami_in_a_Gottex_Bathing_Suit.jpg>)
by Yaakov Saar for the Israeli Government Press Office, 1980._
