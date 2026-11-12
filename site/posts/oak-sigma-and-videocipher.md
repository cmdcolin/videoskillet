---
title: 'More scramble channels: Oak Sigma and VideoCipher II'
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

We made two new scrambler presets, Oak Sigma and VideoCipher II! Without a
decoder you get a speckled ribbon of encrypted sound down the screen and the
picture as a negative. Try
[VideoCipher II](/app/#preset=videoCipher&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
and
[Oak Sigma](/app/#preset=oakSigma&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

In our [scrambled channel](/blog/better-scramble-channel/) post, we simulated
the channels that old
[Jerrold](https://en.wikipedia.org/wiki/Jerrold_Electronics) and
[General Instrument](https://en.wikipedia.org/wiki/General_Instrument) boxes
decoded, by weakening the sync pulses that tell the TV where each line starts.
Oak Sigma and VideoCipher II took the sync out entirely, put encrypted sound
data in its place and turned the video into a negative.

We built every scrambler into the **Channel** stage as the head-end, so your
source stays a clean picture and your TV gets the signal a non-subscriber's set
got.

<figure>
<img src="/blog/oak-sigma-and-videocipher-map.svg" alt="The look's place in the app's signal path: Source A, Mix, Channel, Receiver and Screen in a row, Source B joining Mix from below, and the Camera and Mixer loops over the top. Channel and Receiver are lit.">
<figcaption>The signal path in the app, with this look's stages lit. The scrambler is the head-end in Channel.</figcaption>
</figure>

## Background

Before streaming, a subscription channel sent its signal through the air or a
cable to everyone, paying or not. The channels kept non-subscribers out by
[scrambling](https://en.wikipedia.org/wiki/Television_encryption) the signal on
purpose. Your TV could still receive the channel, but the picture rolled, tore
and flashed, and you couldn't watch it. When you subscribed, you rented a
decoder box that put the signal back together.

[Oak Industries](https://en.wikipedia.org/wiki/Oak_Industries) made the
scrambling boxes behind
[ON TV](<https://en.wikipedia.org/wiki/ON_TV_(TV_network)#/media/File:ONTV_Box_-_front.jpg>),
a US pay-TV channel that broadcast over the air. Oak's later Sigma system moved
the same idea onto cable, and
[VideoCipher II](https://en.wikipedia.org/wiki/Videocipher) did it for
satellite, where people with backyard dishes could pick up channels the
broadcasters never meant for them.

![An ON TV decoder box: a black front panel in a woodgrain frame, with the striped blue ON logo and "Subscription TV" on the left, an OFF/ON knob on the right, and "Tune TV to ch 3 for ON" below it.](/blog/oak-ontv-decoder.webp)

Each system used its own simple trick, so each scrambled picture failed in its
own way, with lost sync, flipped brightness or a data ribbon where the sync
belongs. Hobbyists who wanted to watch without paying built their own decoders,
which is part of why the makers kept adding to their systems.

## VideoCipher II

We made VideoCipher II hide the sound inside the picture. We put sound and
addressing data (which told each box whether you had paid) at the start of every
line, where the sync pulse belongs, and sat the
[colour burst](https://en.wikipedia.org/wiki/Color_burst), the TV's colour
reference, on a mid-grey step after it. We inverted the video at 1.4 times the
gain, so the brightest parts of the scene sink below black, and the TV mistakes
them for sync pulses and tears the picture there. Open
[VideoCipher II](/app/#preset=videoCipher&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
to watch it tear the catalogue cover live.

![The catalogue cover torn into horizontal slabs of red, violet, blue and green, with a wide ribbon of black-and-white speckle winding down the middle of the frame.](/blog/scramble-videocipher.webp)

## Oak Sigma

Without a decoder, Oak Sigma runs a speckled ribbon down the side of the screen
and turns the picture negative without warning. We replaced each line's sync
pulse with three bytes of data at 250 nanoseconds a bit: a clock byte and two
bytes of encrypted sound. We made the level of that data wobble at about 15 Hz.
The real system flipped the picture to negative at scene changes, at most once
every 3 seconds. We flip ours at random intervals of 3 to 25 seconds, so you
never know when the negative is coming.

![The 1984 catalogue cover as a negative. The model is green at the head, violet across the arms, blue at the waist and magenta at the knees, and a ribbon of black-and-white speckle with wavy edges runs down the right of the frame.](/blog/scramble-oak-sigma.webp)

## Where the numbers come from

We took Sigma's timing from Oak's US patents
[4,336,553](https://patents.google.com/patent/US4336553A) and
[4,340,906](https://patents.google.com/patent/US4340906A), and VideoCipher II's
from Communications Technology (June 1986, page 70). We chose the data levels
and the inversion level ourselves.

_The catalogue cover is LIZ fashion's
[1984 catalogue cover](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg),
from Wikimedia Commons under CC BY-SA 3.0, and the stills of it here are under
the same licence. The photo of the ON TV box is
[ONTV Box - front](https://commons.wikimedia.org/wiki/File:ONTV_Box_-_front.jpg)
by OddityArchive, from Wikimedia Commons under CC BY-SA 4.0._
