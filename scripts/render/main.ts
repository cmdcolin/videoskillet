// The binary's front door, and the only thing in it: which subcommand ran.
//
//   videoskillet in.mp4 out.mov --preset=vhs     render, the default
//   videoskillet render in.mp4 out.mov …         the same, said out loud
//   videoskillet serve                           the app, hosted from here
//
// Rendering stays the default because it is what the program was, and a
// released binary must not turn a working command line into a usage error.
//
// The two halves are reached through dynamic imports so that only the one that
// ran is evaluated: `render.ts` builds a GPU device and pulls in the whole
// engine bundle, and `serve/main.ts` opens a socket. Both specifiers are
// literal, which is what `deno compile` needs to see to put them in the
// executable.

const HELP = `videoskillet — an NTSC signal path, off the browser.

  videoskillet <in> <out> [options]   run a look over a file (see --help)
  videoskillet render …               the same command, named
  videoskillet serve [options]        host the app on this machine

  render --help                       every render flag
  serve --help                        every serve flag

\`serve\` is the app you already know, with one thing the hosted copy cannot
have: the video-URL source, which fetches a clip from any site yt-dlp handles.
It needs yt-dlp on the machine, so only a server on the machine can offer it.`

const bare =
  Deno.args.length === 0 ||
  (Deno.args.length === 1 && ['--help', '-h', 'help'].includes(Deno.args[0]))

if (Deno.args[0] === 'serve') {
  await import('../serve/main.ts')
} else if (bare) {
  console.log(HELP)
} else {
  await import('./render.ts')
}
