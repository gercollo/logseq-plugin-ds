# Development

[← readme](../readme.md)

## Build and validate

Use the pnpm version pinned in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

The build runs TypeScript checks and writes the unpacked plugin to `dist/`. Unit tests cover
request shaping, authentication, endpoint URLs, command dispatch, parsers and graph updates.
An HTTP integration test covers a complete search conversation against a local compatible server.

Work on a branch and open a pull request against this fork's `main`. CI runs on pull requests;
merging a release-worthy change to `main` runs the release workflow. Generated documentation
must match the prompt definitions: use `pnpm docs:prompts` after changing a prompt.

## Source layout

| File | Responsibility |
| --- | --- |
| `src/main.ts` | Logseq SDK wiring |
| `src/plugin.ts` | Read settings, register commands, run prompts and report errors |
| `src/chat.ts` | OpenAI-compatible Chat Completions client |
| `src/settings.ts` | Endpoint, model, authentication and command settings |
| `src/graph.ts` | File-graph and DB-graph operations |
| `src/block.ts` / `src/outline.ts` | Block metadata, tags, outline parsing and subtree rewrites |
| `src/prompt.ts` / `src/prompts/` | Custom prompt validation and built-in commands |
| `src/parsers.ts` | List and JSON output handling |
| `src/search.ts` / `src/verify.ts` | Tavily search and the function-calling loop |
| `live/` | Optional live prompt evaluation |

## Changing a prompt: run the live suite

The live suite sends the same messages and options as the plugin and checks properties of the
reply, rather than matching its exact text. The grid covers English and German inputs across
questions, true and false claims, opinions, outlines, code and short notes.

```sh
OPENAI_API_KEY=your-key pnpm test:live
OPENAI_BASE_URL=http://localhost:1234/v1 OPENAI_MODEL=your-loaded-model pnpm test:live
LIVE_COMMANDS=Polish,Shorten LIVE_SAMPLES=5 pnpm test:live
LIVE_SCOPE=full pnpm test:live
LIVE_BASELINE=write pnpm test:live
```

Credentials can also come from `~/.logseq/settings/logseq-plugin-openai-assistant.json`.
`LIVE_SETTINGS` selects a different file. Environment variables override the file; never commit
credentials. The file's Extra HTTP Headers and Send Temperature settings also apply.
Searching commands require a `TAVILY_API_KEY` or a search key in the settings file, plus a model
that supports function calling. Every run can incur inference and search charges.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | Endpoint connection and model |
| `TAVILY_API_KEY` | Optional web search |
| `LIVE_COMMANDS` / `LIVE_KINDS` / `LIVE_LANGS` | Narrow the grid |
| `LIVE_SAMPLES` / `LIVE_MIN_PASS` | Repeated samples and minimum passing rate |
| `LIVE_SEARCH=0` | Omit searching commands |
| `LIVE_FORCED=1` | Exercise the forced-answer path |
| `LIVE_CONCURRENCY` / `LIVE_SEARCH_CONCURRENCY` | Request concurrency |
| `LIVE_MODEL` | Override the model for the run |
| `LIVE_BASELINE=write` | Record measured results in `live/baseline.json` |

Run reports are written to `live/last-run.json` and `live/last-run.txt`, both ignored by Git.
No baseline ships with this fork. Record a new baseline against your chosen endpoint before
comparing prompt changes. A baseline describes that model and run, not every compatible provider.
