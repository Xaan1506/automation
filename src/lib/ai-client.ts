import OpenAI from 'openai';

export type AIProvider = 'openai' | 'groq';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_OPENAI_MODEL = 'gpt-4o';

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigurationError';
  }
}

function getAIProvider(): AIProvider {
  const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (configuredProvider === 'groq' || configuredProvider === 'openai') {
    return configuredProvider;
  }
  if (configuredProvider) {
    throw new AIConfigurationError('AI_PROVIDER must be set to "groq" or "openai".');
  }

  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  return process.env.GROQ_API_KEY?.trim() || openAIKey?.startsWith('gsk_')
    ? 'groq'
    : 'openai';
}

function getAPIKey(provider: AIProvider): string | undefined {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openAIKey = process.env.OPENAI_API_KEY?.trim();

  const key = provider === 'groq'
    ? groqKey || (openAIKey?.startsWith('gsk_') ? openAIKey : undefined)
    : openAIKey;

  return key && !/^your[-_ ]/i.test(key) ? key : undefined;
}

export function getAIModel(): string {
  const provider = getAIProvider();
  const configuredModel = process.env.AI_MODEL?.trim();

  if (provider === 'groq') {
    if (!configuredModel || /^gpt-/i.test(configuredModel)) {
      return DEFAULT_GROQ_MODEL;
    }
    return configuredModel;
  }

  return configuredModel || DEFAULT_OPENAI_MODEL;
}

export function isAIConfigured(): boolean {
  try {
    return Boolean(getAPIKey(getAIProvider()));
  } catch {
    return false;
  }
}

export function getAIClient(): OpenAI {
  const provider = getAIProvider();
  const apiKey = getAPIKey(provider);
  if (!apiKey) {
    throw new AIConfigurationError(
      'Configure GROQ_API_KEY or OPENAI_API_KEY to enable AI features.'
    );
  }

  const baseURL = process.env.AI_BASE_URL?.trim() ||
    (provider === 'groq' ? GROQ_BASE_URL : undefined);

  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}
