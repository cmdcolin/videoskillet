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

The [scrambled channel](/blog/better-scramble-channel/) lowers the sync pulses.
Oak Sigma and VideoCipher II removed them, sent encrypted sound data in their
place and inverted the video.

## VideoCipher II

Sound and addressing data occupy the front porch and sync of every line, and the
burst sits on a mid-grey back porch. The video is inverted at 1.4 times the
gain, so the brightest parts of the scene become the lowest levels on the line,
and the set's sync separator locks to them.

![The catalogue cover torn into horizontal slabs of red, violet, blue and green, with a wide ribbon of black-and-white speckle winding down the middle of the frame.](/blog/scramble-videocipher.webp)

## Oak Sigma

Each line's sync is replaced by three bytes at 250 ns a bit: a clock byte and
two bytes of encrypted sound, with their level modulated at about 15 Hz. Sigma
inverted whole fields at scene changes, at most once every 3 seconds. The preset
inverts at random intervals of 3 to 25 seconds.

![The 1984 catalogue cover as a negative. The model is green at the head, violet across the arms, blue at the waist and magenta at the knees, and a ribbon of black-and-white speckle with wavy edges runs down the right of the frame.](/blog/scramble-oak-sigma.webp)

## Sources

Sigma's timing comes from Oak's US patents
[4,336,553](https://patents.google.com/patent/US4336553A) and
[4,340,906](https://patents.google.com/patent/US4340906A), and VideoCipher II's
from Communications Technology (June 1986, page 70). The data levels and the
inversion level are our choice.

The [camera loop post](/blog/scrambled-channel-in-a-loop/) covers the other
scrambler presets from the same release.

_The catalogue cover is LIZ fashion's
[1984 catalogue cover](https://commons.wikimedia.org/wiki/File:%D7%A7%D7%98%D7%9C%D7%95%D7%92_1984_-_1.jpg),
from Wikimedia Commons under CC BY-SA 3.0, and the stills of it here are under
the same licence._
