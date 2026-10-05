# How it works

[← readme](../readme.md)

## File graphs and DB graphs

Logseq stores a block differently depending on the backend, and the plugin adapts to whichever
graph is open — checked per command, so switching graphs needs no reload.

| | File graph | DB graph |
| --- | --- | --- |
| Block text | `content`, mixed with `key:: value` lines | `title` |
| Properties | text lines inside the block | separate entities |
| What `/Summarize` writes | a `summarize:: …` line | a `summarize` property via the API |

On a file graph the property lines are split off before the text is sent, and restored
untouched afterwards — after the first line, or in front of the block when it opens with a
code fence, a table, a quote or a list, which is where Logseq itself keeps them for such blocks
(after a fence line they would sit inside the code, and an `id::` there no longer holds the
block's references). On a DB graph the text can be replaced without touching properties at
all, so nothing has to be reassembled.

**The DB path has been exercised in a real DB graph, in Logseq, by hand.** `/Ask AI`,
`/Tone:`, `/Summarize` and `/Shorten` were each run on a block with children; the property was
created and set, the subtree was rewritten, and a `((reference))` to one of the rewritten
children still resolved afterwards. `marketplace/manifest.json` declares `supportsDB: true` on
that basis. What has been added since has not run inside Logseq on either backend, only
against an in-memory graph in the tests: a point a rewrite adds under a parent that already has
one is inserted as the sibling after that point (`insertBlock(…, { sibling: true })`) rather
than as the parent's last child; a fence a block leaves open is closed in the outline the model
sees; a reply wrapped in a code fence is unwrapped; a Markdown list inside a block survives a
tab-indented reply; and a `key:: value` or `id::` line the model writes is handled as described
under *Rewriting a block that has children*.

Three details were confirmed separately through Logseq's CLI rather than inferred from type
definitions:

- A `#[[🤖]]` tag written into a block's text stays in the text: the DB records a reference to
  the `🤖` page but does not move the tag into a separate tag field, and reads the title back
  with the tag spelled out. So the tag behaviour described in the readme under *Giving it
  context* — including skipping tagged children — holds on both backends.
- A title that ends with a code fence and then the tag on its own line is stored exactly so;
  nothing folds the tag back onto the fence line.
- A DB graph refuses to put a property on a block until that property exists
  (`Property :summarize doesn't exist yet`), and then stores it under a namespaced ident of
  its own, not under the name given. `/Summarize` therefore defines the property before
  writing it, and if the write is still refused you get a message saying so and suggesting
  `output: insert` instead.

The first of those was re-checked on 2026-09-16 (Logseq CLI revision `a60c12d`, DB schema
65.33, `@logseq/libs` 0.3.4 bundled) on a throwaway DB graph, because everything the plugin does
with the tag rests on it. `#[[🤖]]`, a plain `#AI` and a bare `#🤖` all came back verbatim in
`:block/title`, before and after the block's text was edited, and whether or not `AI` existed as
a tag; none of them was moved into `:block/tags`. The one form that does live in `:block/tags`
and is missing from the title is a tag set through the tags property itself (the CLI's
`--update-tags`; in Logseq, the tag picker) — the plugin never writes one that way, so
`hasTag` keeps seeing exactly what `withTag` wrote. Two things this check cannot say: it went
through the CLI's outliner, not the editor inside Logseq, and editing the text through the
CLI dropped the block's `:block/refs` entry for `🤖` while the tag text stayed — so the `🤖`
page may not list every tagged block. The plugin does not rely on that reference.

The SDK is bundled with the plugin; what matters is the Logseq build. The DB path needs a build
that exposes `checkCurrentIsDbGraph` and `upsertBlockProperty`. On older builds, where
`checkCurrentIsDbGraph` does not exist, the plugin takes the file-graph path — which is correct,
since those builds only have file graphs. On newer builds that hand back a file-graph block with
the markdown in `title` and no `content`, the file-graph path reads `title` instead.

**The file-graph path is the one that has never run inside Logseq.** It is covered by unit
tests and it is what upstream's code did, but the machine this was developed on has only DB
graphs, so nothing exercised it end to end — including whether the bundled `@logseq/libs` 0.3.x
client boots at all inside an older, file-graph-only Logseq build. If you use a file graph,
treat the first few runs as a trial and keep an eye on your block properties.

## Rewriting a block that has children

`/Polish`, `/Shorten`, `/Expand` and the `/Tone:` commands rewrite the block **and everything
under it**. The model gets the subtree as an outline and returns a rewritten one; the plugin
applies it back over the blocks that already exist, updating each in place so its identity —
and therefore any `((reference))` to it, and its properties — survives. The rewrite may merge
or split lines: extra lines become new blocks, and blocks left over are removed.

Two things are never removed. A block something links to: on a file graph that is a block
carrying `id::`, which Logseq writes only once a reference exists; on a DB graph the plugin
does not query what links to a block, so **nothing is removed there at all**. And a note of
yours the model was never shown: a surplus block is kept when the plugin's own tagged output
under it holds a block you wrote (a follow-up under an `/Ask AI` answer, say), or when a
referenced block sits inside that output or under an empty block. The tagged output on its own
goes with the point it answered. Either way the surplus block stays put and a notification
tells you how many were kept, for you to delete by hand.

A block with several lines — two paragraphs, a fenced code block, a Markdown list — stays one
block: a line without a bullet is read as the continuation of the point above it, and so is a
list line (`- a`, `1. b`) that sits where a continuation line would — indented with the point's
tabs plus two spaces, or unindented under the block itself. That relies on the reply keeping
the tab indentation the model was given. A reply indented with spaces alone cannot tell a list
line from a sub-point, and neither can a block with no children, where there is no tab anywhere
to measure against; in those two cases a list inside the block comes back as child blocks. A
code fence a block leaves open is closed in the outline the model sees, so it cannot swallow
the points after it; a reply the model wrapped whole in a ```` ```markdown ```` fence is
unwrapped rather than written back as one code block (a code block being rewritten keeps a
fence of its own kind, since there the fence is the content — but a ```` ```markdown ```` one
is still the model's wrapper); and a `key:: value` line the model
writes becomes a property of the block, set once, never replacing one the block already has.
Children the model was never shown are left out when the rewrite is lined up against the existing blocks:
the plugin's own tagged output, and blocks with no text of their own. So `/Polish` after
`/Ask AI` on the same block leaves the answer where it is instead of writing over it, and a
point the rewrite adds goes in right after the last point the model saw, not after that answer.

The block you run a rewrite command in has to have text of its own. In an empty block the first
child would be taken for the block itself and every line after it would land one block up, so
the plugin refuses instead (`This block has no text of its own to rewrite…`); run it on one of
the children.

Because one command can now touch several blocks, undo may take more than one Ctrl+Z.

`/Ask AI` answers from the model's own knowledge, which has a cutoff. **`/Ask Online`**
searches for current information and cites the URLs returned by the search tool. It requires
an endpoint and model that support OpenAI-style function calling.

## Checking against sources: `/Verify Online`

`/Fact Check` judges from the model's own knowledge. `/Verify Online` searches instead:

```text
- The Sun orbits Earth.    ← /Verify Online
    ↓
  - ❌ The Sun orbits Earth → Earth orbits the Sun — <source URL>
  - ✅ <a claim supported by a source> — <source URL>
  - ❓ <a claim no source settled>
```

The command checks only what the text asserts. A question, heading, code block or opinion
has nothing to verify. Confirmed claims receive a ✅; conflicting evidence receives a ❌;
unsettled claims receive a ❓. Model output can still be wrong, so review the cited sources.

Searching commands are registered only when a Web Search API Key is set. The key is for
[Tavily](https://tavily.com); reload the plugin after setting or clearing it. Each command
can make several chat requests and searches, so latency and cost depend on the endpoint,
model and number of searches.

The model can search for at most four rounds, then must answer using the results it has.
Transient search failures are reported back to the model. Invalid keys and exhausted quotas
stop the command with an actionable error. Tavily receives the model's search queries.

Tool definitions stay in the conversation through the final answer. Any reasoning content
returned alongside tool calls is passed back between rounds; it is never written to a block.
Leaked tool-call markup is rejected instead of being inserted into notes.

Tavily returns cleaned page text, so the plugin does not need to fetch source pages separately
from Logseq's browser runtime. The tool loop is covered by unit and local HTTP integration tests.
