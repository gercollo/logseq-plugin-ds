import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin.user';
import { DEFAULT_BASE_PATH } from './chat';
import { IPrompt } from './prompts/type';

/** The settings as the plugin uses them; see {@link readSettings}. */
export interface ISettings {
  apiKey: string;
  basePath: string;
  model: string;
  temperature: number | undefined;
  sendTemperature: boolean;
  extraHeaders: unknown;
  searchApiKey: string;
  tag: string;
  /** Validated by `resolvePrompts`; anything may be in the settings file. */
  customPrompts: unknown;
}

/** What a well-formed `customPrompts` looks like. */
export interface CustomPromptsSetting {
  enable?: boolean;
  prompts?: IPrompt[];
}

export const SETTING_DEFAULTS = {
  basePath: DEFAULT_BASE_PATH,
  model: 'gpt-4o-mini',
  temperature: 0.3,
  tag: '[[🤖]]',
} as const;

/**
 * Logseq's settings panel saves a `number` field as a string once the user has
 * touched it (`"temperature": "0.3"` in the settings file), and a string is not
 * a temperature the client will send. Blank or unparseable means "not set".
 */
export function readTemperature(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return Number(value);
  }
  return undefined;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * The stored settings made safe to use. Logseq's settings panel keeps every
 * text field a string, but the settings file can be edited by hand, and a
 * number or `null` where a string is expected used to throw inside a command
 * ("apiKey.trim is not a function") — or, for `searchApiKey`, at startup,
 * before any command was registered. Missing and wrong-typed values read as
 * unset; the defaults are applied where they are used.
 */
export function readSettings(raw: unknown): ISettings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    apiKey: text(s.apiKey),
    basePath: text(s.basePath),
    model: text(s.model),
    temperature: readTemperature(s.temperature),
    sendTemperature: s.sendTemperature !== false,
    extraHeaders: s.extraHeaders ?? {},
    searchApiKey: text(s.searchApiKey),
    tag: text(s.tag),
    customPrompts: s.customPrompts,
  };
}

const settings: SettingSchemaDesc[] = [
  {
    key: 'apiKey',
    type: 'string',
    title: 'API Key',
    description:
      'Your endpoint\'s API key, sent as a Bearer token. Leave empty for local servers ' +
      'without authentication or use Extra HTTP Headers for other authentication schemes.',
    default: '',
  },
  {
    key: 'basePath',
    type: 'string',
    title: 'API Base URL',
    description:
      'Any OpenAI-compatible Chat Completions base URL (include /v1 if needed), ' +
      'or the full /chat/completions URL. Supports http:// local servers and query parameters.',
    default: SETTING_DEFAULTS.basePath,
  },
  {
    key: 'model',
    type: 'string',
    title: 'Model',
    description:
      'Any model or deployment name supported by your endpoint. Custom prompts can override this.',
    default: SETTING_DEFAULTS.model,
  },
  {
    key: 'temperature',
    type: 'number',
    title: 'Temperature',
    description:
      'Sampling temperature, 0.0 - 2.0. Low values keep the answer close to your ' +
      'own text, which suits the rewriting commands (Polish, Shorten, Tone). Raise ' +
      'it towards 1.3 if you want Brainstorm or Ask AI to range wider. Ignored by ' +
      'known reasoning models. Disable Send Temperature for other models that reject it.',
    default: SETTING_DEFAULTS.temperature,
  },
  {
    key: 'sendTemperature',
    type: 'boolean',
    title: 'Send Temperature',
    description: 'Turn off to use the server default or when your model rejects temperature.',
    default: true,
  },
  {
    key: 'extraHeaders',
    type: 'object',
    title: 'Extra HTTP Headers',
    description:
      'Optional JSON object of header names and string values, e.g. {"api-key":"your-key"}. ' +
      'Overrides default headers, including Authorization, case-insensitively.',
    default: {},
  },
  {
    key: 'searchApiKey',
    type: 'string',
    title: 'Web Search API Key (optional)',
    description:
      'A Tavily API key (https://tavily.com), which enables the commands that search the web: ' +
      '"/Ask Online", "/Verify Online" and any custom prompt with "search": true. Without a key ' +
      'they are not registered at all and nothing else changes. Reload the plugin after setting it.',
    default: '',
  },
  {
    key: 'tag',
    type: 'string',
    title: 'Tag',
    description:
      'Tag appended to AI-generated content (without the leading #). Leave empty ' +
      'to disable.',
    default: SETTING_DEFAULTS.tag,
  },
  {
    key: 'customPrompts',
    type: 'object',
    title: 'Custom Prompts',
    description:
      'Enable and manage custom prompts. Edits to an existing prompt apply at once; ' +
      'reload the plugin after adding or renaming one so its slash command is registered.',
    default: {
      enable: false,
      prompts: [],
    },
  },
];

export default settings;
