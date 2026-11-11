---
title: Oak Sigma and VideoCipher II
date: 2026-11-11
summary:
  The scrambler has two systems that sent encrypted sound where the timing marks
  were. A TV with no decoder shows the data as a speckled ribbon down the screen
  and the picture as a negative.
image: /blog/scramble-videocipher.webp
imageAlt:
  The catalogue cover torn into horizontal slabs of red, violet, blue and green,
  with a wide ribbon of black-and-white speckle winding down the middle of the
  frame.
look: '#preset=videoCipher&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg'
---

Try it:
[VideoCipher II](/app/#preset=videoCipher&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg)
and
[Oak Sigma](/app/#preset=oakSigma&iurl=https://upload.wikimedia.org/wikipedia/commons/f/f9/%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg).

The [scrambled channel](/blog/better-scramble-channel/) preset lowers the sync
pulses, so a TV with no decoder loses its timing marks and tears the picture.
Oak's Sigma system and the VideoCipher II satellite system removed the sync
pulses altogether and sent encrypted sound in their place. A TV with no decoder
shows that data as a speckled ribbon wandering down the screen, and the picture
as a negative.

## VideoCipher II

VideoCipher II sent encrypted sound and addressing in the front porch and the
sync pulse of every line. The back porch and the colour burst are lifted to the
middle of the video range, and the vertical interval holds a full-height pattern
in place of its pulses. The picture is sent as a negative at 1.4 times the
contrast, so the brightest parts of the scene become the darkest parts of the
signal, and the TV takes them for timing marks and tears around them.

![The catalogue cover torn into horizontal slabs of red, violet, blue and green, with a wide ribbon of black-and-white speckle winding down the middle of the frame.](/blog/scramble-videocipher.webp)

## Oak Sigma

Sigma removed every sync pulse, line and field. Three bytes sit where each
line's sync pulse was, a clock byte and two bytes of encrypted sound, at 250 ns
a bit, and their level swings on a sine near 15 Hz. A pattern of bits stands in
for the field pulses, and the colour burst is kept on a raised level. Whole
fields turn negative and back, and Sigma switched them at scene changes, at most
once in three seconds. The preset switches at random every 3 to 25 seconds.

![The 1984 catalogue cover as a negative. The model is green at the head, violet across the arms, blue at the waist and magenta at the knees, and a ribbon of black-and-white speckle with wavy edges runs down the right of the frame.](/blog/scramble-oak-sigma.webp)

## Sources

Oak's US patents [4,336,553](https://patents.google.com/patent/US4336553A) and
[4,340,906](https://patents.google.com/patent/US4340906A) give Sigma's timing,
and an article in Communications Technology (June 1986, page 70) gives
VideoCipher II's timing and gain. The patents give no data levels, and the
article does not say which level the picture is inverted around, so we chose
those values.

The [camera loop post](/blog/scrambled-channel-in-a-loop/) covers the other
scrambler presets from the same release.

_The catalogue cover is LIZ fashion's
[1984 catalogue cover](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg),
from Wikimedia Commons under CC BY-SA 3.0, and the stills of it here are under
the same licence._
