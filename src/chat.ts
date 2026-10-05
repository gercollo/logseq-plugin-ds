export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Present on an assistant turn that asked for a tool to be run. */
  tool_calls?: ToolCall[];
  /** Optional reasoning text echoed back when continuing a tool conversation. */
  reasoning_content?: string;
  /** Set on a `tool` message, echoing the call it answers. */
  tool_call_id?: string;
}

/** A tool offered to the model, in the OpenAI-compatible Chat Completions shape. */
export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  /** Leave empty for servers that do not require authentication. */
  apiKey: string;
  basePath: string;
  model: string;
  temperature?: number;
  /** Additional HTTP headers, including provider-specific authentication. */
  extraHeaders?: unknown;
  /** Abort the request after this long. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Injection point for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Tools the model may ask to have run. Omitted entirely when empty. */
  tools?: ToolSpec[];
  /**
   * `'none'` keeps the tool definitions in the request but forbids calling them,
   * which is how a model that has searched enough is made to answer. Sent only
   * together with `tools`.
   */
  toolChoice?: 'auto' | 'none' | 'required';
}

export interface ChatResult {
  content: string;
  /** `stop` normally; `length` when the answer was cut off at the output limit. */
  finishReason?: string;
  /** Tools the model wants run before it will answer. */
  toolCalls?: ToolCall[];
  /** A reasoning model's thinking, when it sent any. Never shown; echoed back in a tool loop. */
  reasoningContent?: string;
}

interface ChatCompletionResponse {
  choices?: {
    message?: { content?: unknown; reasoning_content?: unknown; tool_calls?: unknown };
    finish_reason?: string;
  }[];
  error?: { message?: string; type?: string; code?: string };
}

/** Long reasoning requests share a five-minute connect and response-body timeout. */
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Quoted in error messages; the settings schema declares the same value as its default. */
export const DEFAULT_BASE_PATH = 'https://api.openai.com/v1';

// Omit sampling parameters conservatively for known reasoning families.
// Deployment aliases and other model families can opt out through settings.
export function isReasoner(model: string) {
  const name = model.split('/').pop() ?? model;
  return /^(?:o[134](?:-|$)|gpt-5(?:[.-]|$))/i.test(name);
}

/** `basePath` may be `https://host`, `https://host/v1`, or the full completions URL. */
export function endpoint(basePath: string) {
  let url: URL;
  try {
    url = new URL(basePath.trim());
  } catch {
    throw new Error('The API Base URL must be a valid http:// or https:// URL.');
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error('The API Base URL must use http:// or https://.');
  }
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = /\/chat\/completions$/.test(path) ? path : `${path}/chat/completions`;
  url.hash = '';
  return url.toString();
}

/** Custom names override defaults case-insensitively; invalid settings fail before fetch. */
export function requestHeaders(apiKey: string, extraHeaders: unknown = {}): Record<string, string> {
  if (typeof extraHeaders !== 'object' || extraHeaders === null || Array.isArray(extraHeaders)) {
    throw new Error('Extra HTTP Headers must be an object with string values.');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  for (const [name, value] of Object.entries(extraHeaders)) {
    if (typeof value !== 'string') {
      throw new Error(`Extra HTTP Headers: "${name}" must have a string value.`);
    }
    try {
      new Headers({ [name]: value });
    } catch {
      throw new Error(`Extra HTTP Headers: "${name}" is not a valid HTTP header.`);
    }
    const previous = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
    if (previous) delete headers[previous];
    headers[name] = value;
  }
  return headers;
}

/** Where the error came from, for a message that says what to change. */
export interface ErrorContext {
  url?: string;
  model?: string;
}

const HTML_BODY = /^\s*<(?:!doctype|html|head|body)\b/i;
const BASE_URL_HINT = `Check the API Base URL setting; the default is ${DEFAULT_BASE_PATH}.`;

/**
 * An HTTP failure as a sentence the user can act on. The status decides the
 * first half; the body's `error.message`, or failing that the body itself,
 * the second. Two answers may indicate an endpoint configuration problem — an HTML error
 * page, and a 404 — so there the base URL is the setting to look at, and an
 * HTML page is not worth quoting.
 */
export function describeHttpError(status: number, body: string, context: ErrorContext = {}) {
  let message: string | undefined;
  try {
    message = (JSON.parse(body) as ChatCompletionResponse).error?.message;
  } catch {
    // not JSON
  }
  // A gateway's own 5xx page is the service being down, not a wrong URL.
  if (message === undefined && status < 500 && HTML_BODY.test(body)) {
    return `API request failed (${status}): ${context.url ?? 'the server'} answered with a web page, not an API reply. ${BASE_URL_HINT}`;
  }
  const detail = (message ?? body.slice(0, 300)).trim();
  const sentence = detail.replace(/\.$/, '');

  switch (status) {
    case 400:
      if (/\bmodel\b/i.test(detail)) {
        const which = context.model ? ` "${context.model}"` : '';
        return `The API rejected the model or its parameters${which} (400): ${sentence}. Check the Model and Temperature settings.`;
      }
      return `The API rejected the request as malformed (400): ${detail}`;
    case 401:
      return `Invalid API key (401): ${detail}`;
    case 402:
      return `API account has insufficient balance (402): ${detail}`;
    case 404:
      return `Nothing answers at ${context.url ?? 'that URL'} (404)${sentence ? `: ${sentence}` : ''}. ${BASE_URL_HINT}`;
    case 422:
      return `The API rejected the request parameters (422): ${detail}`;
    case 429:
      return `API rate limit reached (429): ${detail}`;
    case 500:
    case 502:
    case 503:
    case 504:
      return `The API is temporarily unavailable (${status}): ${detail}`;
    default:
      return `API request failed (${status}): ${detail}`;
  }
}

/** Builds the JSON body for `/chat/completions`. Exported for tests. */
export function buildRequestBody(
  messages: ChatMessage[],
  model: string,
  temperature: number | undefined,
  tools?: ToolSpec[],
  toolChoice?: ChatOptions['toolChoice'],
): Record<string, unknown> {
  const body: Record<string, unknown> = { model, messages, stream: false };
  if (!isReasoner(model) && typeof temperature === 'number' && Number.isFinite(temperature)) {
    body.temperature = temperature;
  }
  // An empty array is not the same as no tools: some endpoints reject it.
  if (tools && tools.length > 0) {
    body.tools = tools;
    if (toolChoice) {
      body.tool_choice = toolChoice;
    }
  }
  return body;
}

function extractContent(payload: ChatCompletionResponse): ChatResult {
  if (payload.error?.message) {
    throw new Error(`The model returned an error: ${payload.error.message}`);
  }

  const choice = payload.choices?.[0];
  const raw = choice?.message?.content;
  const content = typeof raw === 'string' ? raw.trim() : '';
  const toolCalls = readToolCalls(choice?.message?.tool_calls);

  // A turn that only asks for tools carries no text, and that is not an error.
  if (!content && !toolCalls) {
    if (choice?.finish_reason === 'length') {
      throw new Error('The model hit the output length limit before producing an answer.');
    }
    throw new Error('The model returned an empty response.');
  }

  const reasoning = choice?.message?.reasoning_content;
  return {
    content,
    finishReason: choice?.finish_reason,
    ...(toolCalls ? { toolCalls } : {}),
    ...(typeof reasoning === 'string' && reasoning ? { reasoningContent: reasoning } : {}),
  };
}

function readToolCalls(value: unknown): ToolCall[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const calls = value.filter(
    (c): c is ToolCall =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as ToolCall).id === 'string' &&
      typeof (c as ToolCall).function?.name === 'string' &&
      typeof (c as ToolCall).function?.arguments === 'string',
  );
  return calls.length > 0 ? calls : undefined;
}

export async function chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
  const apiKey = options.apiKey?.trim();
  const basePath = options.basePath?.trim();
  const model = options.model?.trim();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = options.fetch ?? fetch;

  if (!basePath) {
    throw new Error('No API Base URL configured. Set it in the plugin settings.');
  }
  if (!model) {
    throw new Error('No model configured. Set it in the plugin settings.');
  }
  // A base URL without a scheme is resolved against the plugin's own origin
  // and fails with a message about that origin, which names nothing the user
  // can change.
  if (!/^https?:\/\//i.test(basePath)) {
    throw new Error(
      `The API Base URL must start with http:// or https:// — it is "${basePath}". ${BASE_URL_HINT}`,
    );
  }

  const url = endpoint(basePath);
  const headers = requestHeaders(apiKey ?? '', options.extraHeaders);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      forwardAbort();
    } else {
      options.signal.addEventListener('abort', forwardAbort, { once: true });
    }
  }

  const explainAbort = () => {
    if (timedOut) {
      return new Error(`The model did not answer within ${Math.round(timeoutMs / 1000)} s.`);
    }
    if (controller.signal.aborted) {
      return new Error('API request was cancelled.');
    }
    return undefined;
  };

  let response: Response;
  let text: string;
  try {
    try {
      response = await doFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildRequestBody(
          messages, model, options.temperature, options.tools, options.toolChoice,
        )),
        signal: controller.signal,
      });
    } catch (error) {
      throw (
        explainAbort() ??
        new Error(
          `Could not reach ${url}: ${(error as Error).message}. ` +
            'Check your network, the API Base URL setting, or use a proxy if requests are blocked.',
        )
      );
    }

    // The body is read under the same timeout: a stalled stream is as bad as a stalled connect.
    try {
      text = await response.text();
    } catch (error) {
      throw explainAbort() ?? new Error(`Reading the API response failed: ${(error as Error).message}`);
    }
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  }

  if (!response.ok) {
    throw new Error(describeHttpError(response.status, text, { url, model }));
  }

  let payload: ChatCompletionResponse;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`The model returned a non-JSON response: ${text.slice(0, 300)}`);
  }

  return extractContent(payload);
}
