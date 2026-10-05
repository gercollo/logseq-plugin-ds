# OpenRouter

[← readme](../readme.md)

OpenRouter can use the plugin's existing Chat Completions client. Configure these plugin settings:

| Setting | Value |
| --- | --- |
| API Base URL | `https://openrouter.ai/api/v1` |
| API Key | Your OpenRouter API key |
| Model | Copy a text Chat Completions model ID from the [OpenRouter model catalog](https://openrouter.ai/models) |
| Extra HTTP Headers | `{}` unless you want app attribution |
| Send Temperature | Turn off if the selected model rejects temperature |

Use the exact catalog ID, including its provider prefix and any variant suffix. Model availability
and parameters depend on the selected model. The plugin passes the ID through unchanged.
An OpenAI API key cannot replace an OpenRouter key. These settings follow
[OpenRouter's official quickstart](https://openrouter.ai/docs/quickstart).

For optional app attribution, Extra HTTP Headers accepts this JSON object:

```json
{
  "HTTP-Referer": "https://github.com/gercollo/logseq-plugin-ds",
  "X-OpenRouter-Title": "Logseq AI Assistant"
}
```

Try `/Ask AI` on a question, then `/Polish` on a short paragraph. Provider changes apply to the
next command. `/Ask Online` and `/Verify Online` additionally require a Tavily key and a model
that supports function calling; reload the plugin after adding the search key.

## Reasoning and search

The search loop now echoes returned `reasoning` and opaque `reasoning_details` with the assistant
tool-call message, preserving block order, signatures and encrypted data. This follows
[OpenRouter's reasoning continuity requirements](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).
Reasoning is never inserted into notes as answer text. Plain commands still use a single request.

## Scope and verification

This integration covers non-streaming text Chat Completions and client-side function calling.
It uses server defaults for routing and reasoning effort. There are no plugin controls for
provider routing, reasoning budgets, automatic model discovery or OpenRouter OAuth.

Automated contract tests use simulated OpenRouter responses to check endpoint construction,
authentication, attribution headers and reasoning continuity through tool calls. They do not
make paid requests. A live model check in Logseq remains necessary to verify your selected
model, account access and the application's network environment.
