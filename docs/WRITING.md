# Writing patterns to fix

`CLAUDE.md` › _Writing_ states the rule: plain technical English, in ordinary
declarative sentences. This file lists the habits that produced prose this repo
has had to rewrite, each with a before-and-after pair to copy. It covers source
comments too, because they record the measurement behind a decision and are
read the way a page of the guide is. One fragment reads as a choice, and a page
of fragments reads as generated, because the sentences stop connecting and the
reader supplies the joins.

The [anti-ai-writing-tropes](https://github.com/cmdcolin/claudish/blob/main/skills/anti-ai-writing-tropes/SKILL.md)
skill holds the full checklist and a `scan.sh` that finds most of these habits.

## Common habits

**A fragment standing in for a sentence.** This is a caption with no verb or a
subject with no predicate, and it usually follows a code block or opens a
bullet.

> Nine load paths, no unit test that can touch them. → There are nine load
> paths, and no unit test reaches any of them.

**An aphorism closing a section.** This is a short balanced sentence that sounds
like a conclusion and states no fact. It survives a first edit because it reads
as style.

> Keep the file and the next one is comparable. → Keeping the file makes the
> next render comparable to this one.
>
> A phone GPU is still a phone GPU. → A phone GPU has much less headroom.

**A conclusion standing in for the mechanism.** This sentence names an outcome,
such as the build stopping or a link breaking, in the place where the sentence
saying how it happens belongs. It states a fact, so the edit that catches an
aphorism leaves it alone, and it gives the reader a verdict with the mechanism
left out. Write what the program does and name it.

> A marker that does not parse stops the build. → `rehype-guide` throws on a
> misspelled tabs marker, so the site build fails.
>
> A row that scrolls hides the choice it exists to offer. → A reader who has to
> scroll the row sideways cannot see every option in it.

**Contrastive framing where the positive half says it.** This covers "X, not
Y", "rather than" and "instead of". Keep one only where the reader needs the
distinction to choose correctly: an ADR naming the option it turned down, a
fault that resembles another one, or a mechanism that multiplies rather than
adds.

> Staleness is stamped, not compared. → Staleness is stamped.

**The cleft: "X is what does Y".** Write the plain verb, then check that its
subject can perform it.

> Sampling at exactly 4 × F_SC is what makes the rest cheap. → Sampling at
> exactly 4 × F_SC puts the subcarrier on a four-phase lattice, so
> `carrier(n, frame)` needs no trig.

**A figure where a literal word exists.** Ask what literal word a verb or noun
stands for, and write that word.

| Figure | Literal |
|---|---|
| carries (a value, a field, a reason) | has, holds, contains, records |
| lives in, lands in | is defined in, is stored in |
| for free, costs nothing | with no extra code, adds no work |
| buys, earns its keep | gives, allows, is needed |
| load-bearing | required, depended on |
| the shape (of data) | the structure, the format |
| a lever, a knob (for a setting) | a parameter, an option |

"Carrier" in the radio sense is a domain term and stays.

**A heading written as a phrase where a noun would do.** Name the subject. Keep
a phrase only where the section answers a question the reader asks in those
words, such as an FAQ entry or a `Why ...` section about the reasoning.

> Where the file goes → Output · What you need before starting → Requirements

**A heading that says what a thing is not.** A reader scanning a contents list
gets nothing from a negative. The exception is a heading whose whole content is
a distinction: "Chaotic is not the same as wild" is the finding of the section
under it, and a positive rewrite states a conclusion the section never reached.

> What it does not do → Limitations · Deliberately not this → Out of scope

**A pronoun centring the program.** A paragraph opening on "it" makes the
software the subject of everything and leaves a reader arriving by deep link
with no antecedent. Name the actor: the renderer, the command, the panel.

> It runs the app's own engine. → The renderer runs the same engine as the app.

**A mannered inversion or a dropped subject.** This fronts the complement, or
opens on "So", "And" or "Hence" and leaves the subject in the previous
sentence.

> Which latency is now known: the lane's own. → The number reports the lane's
> latency.

**Cute naming in a reference table.** A flag table, a keyboard table and a
column header are read by someone looking one thing up, and a joke makes them
read it twice.

> `--seed=<n>` | the dice → `--seed=<n>` | random seed; the same seed gives the
> same file

**A rule-of-three list doing a sentence's work.** This is three parallel
fragments with the verbs dropped, in the place of one sentence with a subject.

> A look off the address bar, a file in, ProRes 4444 out. → The command reads
> the look from the address bar and the picture from the file, and writes
> ProRes 4444.

**Two clauses stacked on one "so".** Split a sentence that reaches a conclusion
and then reaches another one, because the reader loses the second conclusion.

> …so a runtime with no bundler can load them, so a look renders here as on
> screen. → …so a runtime with no bundler can load them. A look therefore
> renders here the way it renders on screen.

**Em-dash asides doing the work of clauses.** One in a paragraph is
punctuation, and three means the writer is avoiding sentence boundaries.
Promote one to its own sentence, demote one to a comma, and keep the one that
is parenthetical.

## Voice, register and terminology

A checklist misses these three, because each looks like the house voice around
it.

**A value given a stance.** A component that runs, such as the parser, the CLI
or a caller, can report or refuse. A sign, a flag, a column, a file or a
coordinate is described with has, contains, lists or marks. The same covers a
subject given a will, since "a strain breaks from the backbone" describes an
absence of alignment, and a sentence that gives an artifact a purpose, such as
"the choice it exists to offer".

> The test is two ends on the backbone with signs that disagree. → A breakpoint
> link has rank 0 at both ends, one ending in `+` and the other in `-`.

**A technical term given a personality.** Keep the term the tools use, since
`--reference backbone` is what minigraph calls it and renaming it leaves the
reader without the word they meet in the manual. Fix the sentence around it.

> stated as an orientation disagreement between two backbone segments → a pair
> of backbone segments entered in opposite orientations

**An informalism in a formal register.** A word can be right in a tutorial and
wrong in a manuscript, so judge it against the document it is in. An
intensifier with no number behind it is the same slip in a document that
quantifies everything else: `dramatically simpler`, `greatly reduced`.

> uploading to the graphics card is slow → uploading to the GPU is slow

## Write a style rule in the style it asks for

`website/docs/tutorials/CLAUDE.md` in the JBrowse repository opens with "No
em-dashes anywhere, including code comments", in a sentence that contained one,
and the file held fifteen more. Agents imitate a rule's prose, so a rule
written with a violation teaches the violation.

## Habits from Wikipedia's list of signs of AI writing

[Wikipedia's signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
lists habits this repo has not had, and each is easy to grep for in text
written outside the repo: promotional adjectives (`vibrant`, `groundbreaking`,
`boasts`), vague attribution (`industry reports`, `observers have cited`),
present-participle synthesis (`highlighting the importance of`,
`underscoring its role`), the `Challenges and Future Prospects` section, and
the cluster around `delve`, `tapestry`, `testament`, `showcase` and `pivotal`.
In `…, highlighting how the two stages interact`, the participle makes a claim
with nobody making it, so write the claim as its own sentence or drop it.

## What a prose pass keeps

- **The claim.** A rewrite that changes what a sentence asserts is worse however
  plain it reads. "Chaotic is not the same as wild" rewritten as "Wildness is
  large coherent structure" says something its section does not support.
- **An author's established idiom.** One flagged instance does not justify
  rewriting a device an author uses deliberately and consistently across a
  corpus. Rewrite the instances where a value, and not a drawn mark, is the
  subject.
- **A term the tools use.** Renaming `--reference backbone` in prose leaves the
  reader without the word the manual uses.
- **The measurement.** Numbers, file paths and the names of mechanisms are the
  content. A prose pass moves sentences around them and changes none of them.
- **The author's own voice** in `README.md`. "Tasty WebGPU signal-level analog
  video emulation" is written by a person and reads like one.
- **The distinctions an ADR is about.** A record that names the option it
  declined needs both halves.
- **Generated prose.** `EFFECTS.md`, `llms.txt`, `llms-full.txt` and the loop
  block in `FEATURES.md` come from `src/ui/controls.ts` via `pnpm docgen`, so an
  edit to the output lasts until the next build. Fix the control table.
