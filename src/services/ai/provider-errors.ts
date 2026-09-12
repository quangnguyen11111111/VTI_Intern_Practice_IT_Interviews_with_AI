export class AiProviderContractError extends Error {
  readonly safeCode = 'AI_OUTPUT_INVALID';

  constructor(message = 'AI provider output did not satisfy the contract') {
    super(message);
    this.name = 'AiProviderContractError';
  }
}

export interface ClassifiedProviderError {
  retryable: boolean;
  safeCode: 'AI_RATE_LIMITED' | 'AI_TIMEOUT' | 'AI_DEPENDENCY_UNAVAILABLE' | 'AI_OUTPUT_INVALID';
}

export const classifyProviderError = (error: unknown): ClassifiedProviderError => {
  if (error instanceof AiProviderContractError || error instanceof SyntaxError) {
    return { retryable: false, safeCode: 'AI_OUTPUT_INVALID' };
  }

  const candidate = error as {
    status?: number;
    statusCode?: number;
    code?: string;
    message?: string;
    response?: { status?: number };
  };
  const status = candidate?.status ?? candidate?.statusCode ?? candidate?.response?.status;
  const code = String(candidate?.code ?? '').toUpperCase();
  const message = String(candidate?.message ?? '').toLowerCase();

  if (status === 429) {
    return { retryable: true, safeCode: 'AI_RATE_LIMITED' };
  }
  if (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKETTIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return { retryable: true, safeCode: 'AI_TIMEOUT' };
  }
  if (typeof status === 'number' && status >= 500 && status <= 599) {
    return { retryable: true, safeCode: 'AI_DEPENDENCY_UNAVAILABLE' };
  }

  return { retryable: false, safeCode: 'AI_OUTPUT_INVALID' };
};
