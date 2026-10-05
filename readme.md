# Logseq AI Assistant

Call any OpenAI-compatible Chat Completions endpoint from a slash command, right inside a Logseq block. **English** | [中文](./readme.zh-CN.md)

Type `/Polish` in a block and your chosen model rewrites it — the block **and the points nested under
it**, each one updated in place. No window switching, no copy-paste; the answer lands in your
notes.

![Polishing a block and its sub-points with one command](./docs/demo.gif)

A public fork of [victos/logseq-plugin-ds](https://github.com/victos/logseq-plugin-ds), itself a port of
[ahonn/logseq-plugin-ai-assistant](https://github.com/ahonn/logseq-plugin-ai-assistant) (MIT).
This fork adds optional authentication, custom headers, query-aware endpoint URLs and
configurable temperature handling. All the existing commands work with your chosen model.

## Quick start

**1. Choose an endpoint and model** — use a hosted provider or start a local OpenAI-compatible server.
For hosted providers, get an API key from that provider.

**2. Install the plugin**

Turn on developer mode in Logseq (`Settings → Advanced → Developer mode`), then either
download the built plugin ZIP from [Releases](https://github.com/gercollo/logseq-plugin-ds/releases),
extract it, or build it yourself:

```sh
pnpm install && pnpm build
```

Then `Plugins → Load unpacked plugin` and pick this folder.

**3. Configure API Base URL, Model and API Key** in the plugin settings. The model name must
exist at that endpoint. Leave the key empty if your server does not require authentication.
See the endpoint examples below.

**4. Try it** — put the cursor in any block and type `/Summarize`.

## The commands

Twelve commands come built in, plus two that need a search key. Type `/` in a block and start typing the name.

![The plugin's commands in the slash menu](./docs/menu.png)

| Command | What it does | Where the answer goes |
| --- | --- | --- |
| `/Ask AI` | Answers the question in the block | New child block |
| `/Summarize` | Condenses the block | A `summarize::` property on the block |
| `/Polish` | Fixes awkward phrasing, redundancy and grammar without changing your voice | Replaces the block text |
| `/Shorten` | Cuts it down, keeping the key points | Replaces the block text |
| `/Expand` | Fills it out with more detail | Replaces the block text |
| `/Explain` | Explains the text or code | New child block |
| `/Fact Check` | Flags statements it believes are objectively false | One child block per error |
| `/Ask Online` | Looks the answer up and cites its sources — **only when a search key is set** | New child block |
| `/Verify Online` | Searches the web and cites a source for each verdict — **only when a search key is set** | One child block per claim |
| `/Brainstorm` | Suggests related ideas | One child block per idea |
| `/Tone: Friendly` `/Tone: Confident` `/Tone: Casual` `/Tone: Professional` | Rewrites in that tone | Replaces the block text |

Type `/tone` to see the four tone commands together.

![Fact Check listing what it believes is false, leaving the block itself alone](./docs/fact_check.png)

**`/Fact Check` never rewrites your text.** It judges correctness from the model's own
knowledge — which can be wrong, and confidently so — so instead of "correcting" the block it
lists each claim it believes is false as a child block, in the form
`❌ the claim → ✅ the correction (reason)`, and leaves your block exactly as it was. If it finds
nothing, it adds one child block saying so. You decide what to change. Treat its output as a
second opinion, not an authority, and verify anything that matters.

**`/Polish` and `/Tone: …` are different jobs.** Polish keeps your register and cleans up the
writing; the Tone commands change the register. Both are explicitly told not to add, remove or
invent information. `/Shorten` and `/Expand` are not — changing the amount of detail is the
point of those two.

Answers come back in the language you wrote in — ask in Chinese, get Chinese; write in English
or German and the answer stays in it, whether the command searches the web or not. (This rule is
built into the preset prompts only; custom prompts say whatever you tell them to.)

Everything the AI writes is tagged `#[[🤖]]` so you can find it later: replaced or appended
text, every child block it inserts, and a block that gained a property. The tag goes at the end
of the text — or on a line of its own after a closing code fence (`` ``` #[[🤖]] `` would stop the
fence closing) or after a `key:: value` line (the tag would become part of the value). You can change or remove the tag in the settings.

### Giving it context

A command reads the block you are in **plus everything nested under it**. So this:

```
- What should we prioritize next quarter?     ← type /Ask AI here
  - Churn rose from 3% to 5%
  - Two enterprise deals slipped to Q4
  - Engineering is at capacity
```

sends all four lines to the model, not just the question.

One exception: child blocks carrying the `#[[🤖]]` tag are skipped, along with anything nested
under them, because the tag is how the plugin recognises its own earlier output. Without this,
running `/Ask AI` and then `/Tone: Professional` on the same block would feed the answer back
in, and the tone command would rewrite the answer instead of the question. The rule is only as
good as the tag:

- The tag is matched as a whole token (`#AI` does not match `#AIDS`), but any child block that
  contains it is skipped — including one you wrote yourself that quotes the tag, and a nested
  block the plugin merely rewrote or gave a property to earlier. Delete the tag from a block to
  have it read again.
- Only the current Tag setting is recognised. Output written under an earlier tag, or while the
  Tag setting was empty, is read like any other block — and with the setting cleared the
  protection is off altogether.
- The block you run the command in is always read, tag or no tag.

Logseq metadata (`id::`, `collapsed::`, and your own `key:: value` lines) is stripped before
sending — the model sees your writing, not the plumbing — and is put back afterwards. If you
run a command while still typing in the block, the plugin uses what is in the editor, not the
last saved version.

## Settings

| Setting | Default | What it is for |
| --- | --- | --- |
| **API Key** | *(empty)* | Your endpoint's key, sent as `Authorization: Bearer …`. Optional for servers without authentication |
| **API Base URL** | `https://api.openai.com/v1` | Base URL including the API prefix, or the full `/chat/completions` URL. HTTP and HTTPS are accepted; query parameters are preserved |
| **Model** | `gpt-4o-mini` | Any model or deployment name supported by your endpoint. A custom prompt can override it |
| **Temperature** | `0.3` | Sampling temperature for models that support it |
| **Send Temperature** | on | Turn off to omit the parameter and use the server default. Automatically omitted for `deepseek-reasoner`, OpenAI `o1`/`o3`/`o4` and `gpt-5` model families |
| **Extra HTTP Headers** | `{}` | JSON object with string values, for provider-specific authentication or routing. Overrides default headers case-insensitively |
| **Tag** | `[[🤖]]` | Added to AI output; write without `#`, or leave empty to disable |
| **Web Search API Key** | *(empty)* | Optional [Tavily](https://tavily.com) key; enables searching commands. Requires a model with function calling |
| **Custom Prompts** | off | Your own commands — see [Writing your own commands](./docs/custom-prompts.md) |

Endpoint, key, headers, model and temperature changes apply to the next command without a reload.
Blank base URL or model fields use their defaults. A blank key sends no Authorization header.
Logseq stores edited number fields as text; both text and numeric temperatures work.
Changing which commands are available (search key or custom command names) needs a reload.

### Endpoint examples

| Provider / server | API Base URL | Model | API Key |
| --- | --- | --- | --- |
| [OpenAI](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) | `https://api.openai.com/v1` | `gpt-4o-mini` or a supported Chat Completions model | OpenAI key |
| DeepSeek | `https://api.deepseek.com/v1` | A model supported by DeepSeek, such as `deepseek-chat` | DeepSeek key |
| [OpenRouter](https://openrouter.ai/docs/quickstart) | `https://openrouter.ai/api/v1` | The provider/model identifier from OpenRouter | OpenRouter key |
| [Ollama](https://docs.ollama.com/api/openai-compatibility) | `http://localhost:11434/v1` | A model you have pulled | Empty for an unauthenticated local server |
| [LM Studio](https://lmstudio.ai/docs/developer/openai-compat) | `http://localhost:1234/v1` | The identifier of a loaded model | Empty unless server authentication is enabled |
| Other gateways / proxies | Their OpenAI-compatible API prefix or full completions URL | Their model or deployment name | As required by the server |

For a deployment endpoint with query parameters, enter its full URL, for example
`https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT/chat/completions?api-version=YOUR_API_VERSION`.
Use the API version specified by your provider. For `api-key` authentication, leave API Key empty
and set Extra HTTP Headers to `{"api-key":"YOUR_KEY"}`. Other custom headers, such as
`{"HTTP-Referer":"https://your-site.example","X-Title":"Logseq"}`, work the same way.

Compatibility means the text **Chat Completions** request/response format, including system messages.
Endpoints that expose only Responses or a provider's native API need a compatible gateway.
The optional searching commands also need OpenAI-style function calling; plain commands do not.
All responses are non-streaming. Known reasoning models omit temperature conservatively; for
other model names or deployment aliases, turn off Send Temperature if the endpoint rejects it.

This fork uses the separate plugin ID `logseq-plugin-openai-assistant`. If moving from DeepSeek
Assistant, copy your settings into this plugin and disable the old plugin to avoid duplicate slash commands.
Existing DeepSeek endpoints and custom prompts remain usable.

## When something goes wrong

Every failure shows up as a Logseq notification. The common ones:

| Message | What to do |
| --- | --- |
| `AI Assistant: configure your API Base URL, Model and API Key …` | The default OpenAI endpoint has no key. Configure your provider, or use a local server |
| `The API Base URL must start with http:// or https:// — it is "…".` | The API Base URL setting has no scheme. Include `http://` or `https://` |
| `Nothing answers at … (404). Check the API Base URL setting …` | The URL points at nothing — a typo in the path, most likely. Check your provider's API path |
| `API request failed (…): … answered with a web page, not an API reply.` | The URL reaches a website, not the API — `platform.deepseek.com` instead of `api.deepseek.com`, say. Use your provider's API URL |
| `The API rejected the model or its parameters "…" (400): …` | Check your model name and the provider's error detail. Turn off Send Temperature if needed |
| `Invalid API key (401): …` | Re-copy the key into settings |
| `API account has insufficient balance (402): …` | Check your provider's billing or quota |
| `API rate limit reached (429): …` | Wait a moment and retry |
| `Could not reach …` | Check your network and the API Base URL |
| `The model did not answer within 300 s.` | Retry with a smaller block or a faster model |
| `The model stopped at its output limit — the answer may be cut off.` | The answer was written but may be truncated. Ask for something shorter |
| `The block is empty — nothing to send to the model.` | The block (and its children) had no text after removing properties |
| `The block was deleted while the model was answering.` | The answer was discarded. Run the command again on the new block |
| `This block has no text of its own to rewrite. Run the command on a block with text, or on one of the children.` | `/Polish`, `/Shorten`, `/Expand`, `/Tone:` and custom `replace` prompts only: the block is empty (or holds only the tag) and has children. Rewriting from here would shift every child up by one, so nothing was sent |
| `The model returned nothing to insert.` | The reply had no usable line — with `/Fact Check`, every line it wrote was about a statement it found nothing wrong with, and those are dropped. Run it again, or on a smaller block |
| `This Logseq version cannot set block properties on a DB graph. Update Logseq, or change the prompt’s "output" away from "property".` | DB graphs only: this Logseq build has no `upsertBlockProperty`. Update Logseq, or give the prompt another `output` |
| `Could not write the "…" property on this DB graph: …` | DB graphs only: the property could not be defined or written; the message says why. Create the property in Logseq first, or give the prompt `output: insert` |
| `The model kept searching without answering (4 rounds). Try a shorter block.` | Searching commands only (`/Ask Online`, `/Verify Online`, custom prompts with `search`): the model wanted a fifth round of searching. Put fewer claims or questions in the block |
| `No Tavily API key configured. Set it in the plugin settings.` | A searching command was registered while a search key was set, and the key has since been cleared (or blanked to spaces). Set it again, or reload the plugin to drop the command |
| `Invalid Tavily API key (401): …` | Re-copy the Tavily key into settings |
| `Tavily rate limit or monthly quota reached (429): …` | The month's searches are used up. Wait for the reset or upgrade the plan |
| `Tavily plan limit reached (432): …` | Your Tavily plan does not allow the request; check the Tavily dashboard |
| `AI Assistant ignored N custom prompt(s): …` | One of your custom prompts is malformed, or the `customPrompts` setting as a whole has the wrong shape; the message says which |
| `Available commands changed. Reload the plugin to update the slash menu.` | You added, renamed or removed a custom prompt, or set or cleared the Web Search API Key. Said once per such change |

Still stuck? Open the Logseq developer console (`Ctrl+Shift+I`) — the full error is logged there.

## More

- [How it works](./docs/how-it-works.md) — what the commands do to a block, the two Logseq
  storage backends, rewriting a block that has children, and how `/Verify Online` checks a claim.
- [The built-in prompts](./docs/built-in-prompts.md) — every command's prompt as it is sent,
  to read or to copy as the starting point for your own.
- [Writing your own commands](./docs/custom-prompts.md) — custom prompts: the fields, the four
  output modes, and letting one search the web.
- [Development](./docs/development.md) — building and testing, the live prompt suite, and what
  changed from the project this was forked from.

## Licence

MIT, same as upstream.
