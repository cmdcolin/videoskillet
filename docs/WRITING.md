# Writing patterns to fix

`CLAUDE.md` › _Writing_ states the rule: plain technical English, in ordinary
declarative sentences. This page is the checklist under it: the specific habits
that produced the prose this repo has had to rewrite, each with a pair from the
docs so the fix is a shape rather than a taste. The last three sections came
from passing the same checklist over other repositories, and they are the ones
it kept missing.

The checklist covers the comments in the source too. A comment here carries the
measurement behind a decision and the reason a later reader should not undo it,
so it gets read the way a page of the guide gets read, and the same habits land
in it. The entry on conclusions below came out of one change whose docs, CSS
comments, script comments and tests all needed the same fix.

They compound. One fragment reads as a choice; a page of them reads as
generated, because the sentences stop connecting to each other and the reader
has to supply the joins. That is the failure the pass below was fixing, and it
is the reason to catch these while writing rather than in a rewrite.

## The ones that keep coming back

**A fragment standing in for a sentence.** A caption with no verb, or a subject
with no predicate, usually after a code block or as a bullet's opening.

> Nine load paths, no unit test that can touch them. → Nine load paths, and no
> unit test can touch them.
>
> What a fingertip gets, on every control the panel shows at 390px. → It
> measures what a fingertip gets, on every control the panel shows at 390px.

**An aphorism closing a section.** A short balanced sentence that sounds like a
conclusion and carries no fact. It is the tic most likely to survive a first
edit, because it reads as style.

> Keep the file and the next one is comparable. → Keeping the file makes the
> next render comparable to this one.
>
> A phone GPU is still a phone GPU. → A phone GPU has much less headroom.
>
> A measurement that lives only in a transcript gets paid for again. → A
> measurement that lives only in a transcript has to be made again.

**A conclusion standing in for the mechanism.** A sentence that names the
outcome — the build stops, the link breaks, the choice is hidden — where the
sentence saying how it happens belongs. It carries a fact, so the edit that
catches an aphorism leaves it alone, and it still hands the reader a verdict
with no machine behind it. Write what the machine does and name the actor
working it; the outcome usually arrives in the same sentence.

> A marker that does not parse stops the build. → The build fails when a marker
> is misspelled.
>
> A marker with a typo in it is the failure that has nothing to show for itself.
> → A renderer draws an HTML comment as nothing at all, so a marker with a typo
> in it leaves the subsections flat.
>
> A row that scrolls hides the choice it exists to offer. → A reader who has to
> scroll the row sideways cannot see the whole choice it offers.
>
> The click is also what proves the tabs work at all. → Those clicks confirm
> that the script still switches the panels.

A sentence in this shape usually hands an artifact a purpose on the way past —
"the choice it exists to offer", "the failure that has nothing to show for
itself". That is the stance rule under _Voice_, arriving through this door.

**Contrastive framing where the positive half says it.** "X, not Y", "rather
than", "instead of", "it is not merely". Keep one only where the reader needs
the distinction to choose correctly — an ADR naming the option it turned down, a
fault that resembles another one, a mechanism that multiplies rather than adds.
Everywhere else, state what is true and stop.

> A render with no audio is a render of a different board, not a quiet one. →
> The same look with no audio produces a different picture.
>
> Staleness is stamped, not compared. → Staleness is stamped.
>
> An install page has routes through it rather than sections of it. → The
> install section of the CLI page offers the reader two routes: take the release
> binary, or take a clone.

**A heading written as a phrase where a noun would do.** "Where the file goes"
and "What you get out" are sentences doing a label's job. Name the subject:
`Output`. Keep a phrase only where the section answers a question the reader
actually asks in those words — an FAQ entry, or a `Why ...` section whose whole
point is the reasoning.

> Where the file goes → Output
>
> What you need before starting → Requirements
>
> How the look gets in → Looks

**A heading that says what a thing is not.** The reader scanning a contents list
gets nothing from a negative. Name the subject, or call a list of limits
`Limitations`. The exception is a heading whose whole content is a distinction —
"Chaotic is not the same as wild" is the finding of the section under it, and a
positive rewrite states a conclusion the section never reached.

> What it does not do → Limitations
>
> What this is not: an NLE plugin → Why this is not an NLE plugin
>
> Deliberately not this → Out of scope
>
> Morphing is the opposite of modulating → Morphing walks the resting values

**A pronoun centring the program.** A paragraph opening on "it" makes the
software the subject of everything and leaves a reader arriving by deep link
with no antecedent. Name the actor: the renderer, the command, the panel, the
decoder.

> It runs the app's own engine. → The renderer runs the app's own engine.
>
> Feed a clip's own sound in and the artifacts move with it. → The artifacts
> move with the input's sound.

**A mannered inversion or a dropped subject.** Fronting the complement, or
opening a sentence with "So", "And" or "Hence" carrying the previous sentence's
subject.

> Which latency is now known: the lane's own. → The latency is now known, and it
> is the lane's own.
>
> So the proper route. → Hence the demuxer route.
>
> And the signal path rolls too. → The signal path rolls too.

**Cute naming in a reference table.** A flag table, a keyboard table and a
column header are read by someone looking one thing up, and a joke costs them a
second pass.

> `--seed=<n>` | the dice → `--seed=<n>` | random seed; the same seed gives the
> same file
>
> Key | Does → Key | Action

**A rule-of-three list doing a sentence's work.** Three parallel fragments,
usually with the verbs dropped, standing where one sentence with a subject
belongs.

> A look off the address bar, a file in, ProRes 4444 out. → The look comes off
> the address bar and the picture out of the file, and the output is
> ProRes 4444.

## Two that are structural

**Two clauses stacked on one "so".** A sentence that reaches a conclusion and
then reaches another one wants splitting; the second conclusion is what the
reader loses.

> …bundled so a JavaScript runtime with no bundler in it can load them, so a
> look renders here as it renders on screen. → …bundled so a JavaScript runtime
> with no bundler in it can load them. A look therefore renders here the way it
> renders on screen.

**Em-dash asides doing the work of clauses.** One in a paragraph is punctuation;
three is a writer avoiding sentence boundaries. Promote one to its own sentence,
demote one to a comma, keep the one that is genuinely parenthetical.

## Voice, register and terminology

These three came out of a pass over other repositories, where the prose was
already clean of everything above. They are the ones a checklist misses, because
each looks like the house voice around it.

**A value given a stance.** A component may speak: a track, a lane, a file or a
caller can say, report or refuse, and a codebase that does this consistently is
using a voice rather than slipping. A **value** may not. A sign, a flag, a
column, a coordinate or a character is a thing being described, so it holds no
opinion and disagrees with nothing.

> The test is two ends on the backbone with signs that disagree. → A breakpoint
> link has rank 0 at both ends, one ending in `+` and the other in `-`.
>
> Each segment draws where its tags say it sits. → Each segment is drawn at the
> position its tags give.
>
> In a stranded library the read also says which strand its transcript came
> from. → In a stranded library the pair flags mark which strand the transcript
> came from.

The same rule covers a subject given a will: "a strain breaks from the backbone"
and "a strain leaving the backbone" describe an absence of alignment, so say
that. "A strain with no alignment to the backbone leaves a white gap."

**A technical term given a personality.** Keep a term the tools use — a
`--reference backbone` is what minigraph calls it, and renaming it in prose
costs the reader the word they will meet in the manual. What to fix is the
sentence around it, where the term acquires a voice or a motive it cannot have.
The term names a structure; the sentence says what the structure does.

> stated as an orientation disagreement between two backbone segments → a pair
> of backbone segments entered in opposite orientations
>
> the force drawing lets the axis go → the force drawing drops the axis

**An informalism in a formal register.** A word can be exactly right in a
tutorial and wrong in a manuscript. The test is the document, not the word.

> blocks of memory held on the graphics card … uploading to the card is slow →
> blocks of memory held on the GPU … uploading to the GPU is slow
>
> a page that exhausts it anyway can drop to the canvas backend → …can fall back
> to the canvas backend
>
> We used @jbrowse/img and @jbrowse/capture extensively in producing the
> tutorials → …to produce the figures in the tutorials

An intensifier with no number behind it is the same slip in a document that
quantifies everything else: `dramatically simpler`, `greatly reduced`,
`extensively`.

## A rule that breaks its own rule teaches the break

`website/docs/tutorials/CLAUDE.md` in the JBrowse repository opens with "No
em-dashes anywhere, including code comments", in a sentence that contained one.
The file held fifteen more, and thirty-one had accumulated across the tutorials
it governs.

A style rule is read as prose before it is read as a rule, and the prose is the
part that gets imitated. So a rule about writing has to hold in the file that
states it, and where that is not obvious the file should say so outright. The
same goes for the examples: a rule illustrated with a violation ships the
violation.

## Not a problem here, worth knowing

[Wikipedia's signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
lists several habits this repo has not had: promotional adjectives (`vibrant`,
`groundbreaking`, `boasts`), vague attribution (`industry reports`,
`observers have cited`), present-participle synthesis
(`highlighting the importance of`, `underscoring its role`), the
`Challenges and Future Prospects` section, and the vocabulary cluster around
`delve`, `tapestry`, `testament`, `showcase`, `pivotal`. They are cheap to grep
for and worth a look on anything written from outside.

The one to watch is the participle:
`…, highlighting how the two stages interact` is a claim with nobody making it.
Write the claim as its own sentence or drop it.

## What not to flatten

- **The claim.** A rewrite that changes what a sentence asserts is a worse
  sentence however plain it reads. The heading exception above came out of
  exactly that: "Chaotic is not the same as wild" rewritten as "Wildness is
  large coherent structure" reads better and says something the section does not
  support.
- **An author's established idiom.** One flagged instance is not licence to
  sweep a device the writer uses deliberately and consistently. "The bubbles say
  where the graph varies" and "a curve says two loci are joined" are a voice,
  forty of them in one corpus; the fix is the value that borrowed that voice,
  not the voice.
- **A term the tools use.** `--reference backbone`, `minigraph backbone`, a
  consensus's backbone read: renaming these in prose leaves the reader without
  the word the manual uses.
- **The measurement.** Numbers, file paths and the names of mechanisms are the
  content. A prose pass moves sentences around them and changes none of them.
- **The author's own voice** in `README.md`. "Tasty WebGPU signal-level analog
  video emulation" and "Fun bonus" are written by a person and read like one.
- **The distinctions an ADR is about.** A record that names the option it
  declined needs both halves.
- **Generated prose.** `EFFECTS.md`, `llms.txt`, `llms-full.txt` and the loop
  block in `FEATURES.md` come from `src/ui/controls.ts` via `pnpm docgen`; an
  edit to the output lasts until the next build. Fix the control table.
