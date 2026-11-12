---
title: Oak Sigma and VideoCipher II
date: 2026-11-11
summary:
  We made two more scrambler presets, Oak Sigma and VideoCipher II. Without a
  decoder you get a speckled ribbon of encrypted sound down the screen and the
  picture as a negative.
image: /blog/scramble-videocipher.webp
imageAlt:
  The catalogue cover torn into horizontal slabs of red, violet, blue and green,
  with a wide ribbon of black-and-white speckle winding down the middle of the
  frame.
look: '#preset=videoCipher&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg'
---

We made two new scrambler presets, based on how real satellite and cable
scramblers hid a channel. Try
[VideoCipher II](/app/#preset=videoCipher&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
and
[Oak Sigma](/app/#preset=oakSigma&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

The [scrambled channel](/blog/better-scramble-channel/) only lowers the sync
pulses. Oak Sigma and VideoCipher II went further: they took the sync out
entirely, put encrypted sound data in its place and turned the video into a
negative. A TV with no decoder shows that data as a speckled ribbon down the
screen.

## Background

Before streaming, a subscription channel had a problem: the signal went out
through the air or a cable to everyone, paying or not. The fix was to scramble
it on purpose. Your TV could still receive the channel, but the picture rolled,
tore and flashed, and you couldn't watch it. When you subscribed, you rented a
decoder box that put the signal back together, a bit like a paid unlock key for
a channel.

Oak Industries made the scrambling boxes behind
[ON TV](<https://en.wikipedia.org/wiki/ON_TV_(TV_network)#/media/File:ONTV_Box_-_front.jpg>),
a US pay-TV channel that broadcast over the air. You rented the box, and without
it the channel arrived scrambled. Oak's later Sigma system moved the same idea
onto cable, and VideoCipher II did it for satellite, where people with backyard
dishes could pick up channels that were never meant for them.

The tricks were simple electronics, so the scrambled pictures all failed in
different ways: lost sync, flipped brightness, a wobbling line. Hobbyists who
wanted to watch without paying built their own decoders, which is part of why
the systems kept getting more elaborate. We like these failures a lot, because
each one is a different way for a TV to lose its picture.

## VideoCipher II

We made VideoCipher II hide the sound inside the picture. Sound and addressing
data take over the front porch and sync of every line, and the burst sits on a
mid-grey back porch. We invert the video at 1.4 times the gain, so the brightest
parts of the scene become the lowest levels on the line, and the TV's sync
separator locks onto those and tears the picture.

## Oak Sigma

We made Oak Sigma swap each line's sync for three bytes at 250 ns a bit: a clock
byte and two bytes of encrypted sound, with their level wobbling at about 15 Hz.
The real system flipped whole fields to negative at scene changes, at most once
every 3 seconds. Ours flips at random intervals of 3 to 25 seconds, so you never
know when the negative is coming.

![The 1984 catalogue cover as a negative. The model is green at the head, violet across the arms, blue at the waist and magenta at the knees, and a ribbon of black-and-white speckle with wavy edges runs down the right of the frame.](/blog/scramble-oak-sigma.webp)

## Where the numbers come from

Sigma's timing is from Oak's US patents
[4,336,553](https://patents.google.com/patent/US4336553A) and
[4,340,906](https://patents.google.com/patent/US4340906A), and VideoCipher II's
is from Communications Technology (June 1986, page 70). The data levels and the
inversion level are our own choice.

There's more from the same release in
[the scrambled channel in a camera loop](/blog/scrambled-channel-in-a-loop/).

_The catalogue cover is LIZ fashion's
[1984 catalogue cover](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg),
from Wikimedia Commons under CC BY-SA 3.0, and the stills of it here are under
the same licence._
