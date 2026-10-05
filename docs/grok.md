# Grok through xAI

[← readme](../readme.md)

The plugin can use xAI's OpenAI-compatible Chat Completions endpoint with its existing settings:

| Setting | Value |
| --- | --- |
| API Base URL | `https://api.x.ai/v1` |
| API Key | An API key created in the [xAI console](https://console.x.ai) |
| Model | `grok-4.7`, or another text model available to your account that supports Chat Completions |
| Extra HTTP Headers | `{}` |
| Send Temperature | Off initially, to use the model's server default |

The base URL and bearer authentication follow [xAI's Chat Completions documentation](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions).
Check the [current model catalog](https://docs.x.ai/developers/models) when selecting a model;
this guide's example is not a pinned default or a guarantee of account access. Turn Send Temperature
back on if you want sampling control and your selected model supports the parameter.

Run `/Ask AI` on a question or `/Polish` on a paragraph. Settings changes apply to the next command.
For `/Ask Online` and `/Verify Online`, add a Tavily key, use a model with function calling and
reload the plugin. These commands run the plugin's own search tool and return results to Grok.

## Scope

xAI documents Chat Completions as a legacy interface; new API features arrive in Responses first.
The plugin currently uses non-streaming text Chat Completions, including system messages and
OpenAI-style client function calls. It has no controls for reasoning effort or xAI's server-side
Web Search / X Search. Supporting Responses would be a separate implementation.
See the [xAI REST reference](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions)
and [function calling guide](https://docs.x.ai/developers/tools/function-calling).

To access Grok through OpenRouter instead, use OpenRouter's endpoint, key and catalog model ID.
Do not reuse the direct xAI key or unprefixed model name with that gateway.

## Verification

Contract tests exercise the real client with simulated xAI replies: bearer authentication,
model and messages, omitted temperature, response usage metadata, and multiple function calls
followed by tool results. No provider-specific runtime adapter is needed for this documented
interface. The tests make no paid requests; a live check in Logseq is still needed for your
account/model availability and the application's network environment.
