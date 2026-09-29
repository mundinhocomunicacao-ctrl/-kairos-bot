export const DIVA_COUNCIL_VERSION = 'diva-morada-council-v1';

export const DIVA_COUNCIL_POLICY = Object.freeze({
  mode: 'PARALLEL_ENSEMBLE',
  identityOwner: 'DIVA_RAIZ',
  providerIsIdentity: false,
  silentPanel: true,
  autoPaidFallback: false,
  output: 'ONE_INTEGRATED_DIVA_RESPONSE',
  spendRule: 'NO_NEW_SPEND_WITHOUT_EXPLICIT_HUMAN_AUTHORIZATION'
});

export const DIVA_COUNCIL_PROVIDERS = Object.freeze([
  'gateway','gemini','openai','anthropic','deepseek','mistral','qwen','kimi',
  'minimax','xai','perplexity','groq','openrouter','cerebras','together',
  'fireworks','huggingface','meta-llama'
]);
