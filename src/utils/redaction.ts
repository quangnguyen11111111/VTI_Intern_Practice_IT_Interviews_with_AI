export const REDACTED = '[REDACTED]';

const sensitiveKey = /authorization|cookie|password|token|otp|secret|api.?key|smtp.?pass|email|phone|prompt|answer|(?:cv|jd)(?:$|[_-]|text|data|file|content|url|path|name)|curriculum|resume|job.?description|setupData/i;
const sensitiveValue = /bearer\s+\S+|basic\s+\S+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\s().-]?){9,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|AIza[\w-]{20,}|(?:mongodb(?:\+srv)?|smtp|https?):\/\/[^\s/]+:[^\s@]+@|-----BEGIN [\w ]*PRIVATE KEY-----|(?:password|token|otp|secret|api[_-]?key)\s*[:=]\s*\S+/i;

// Defense in depth for diagnostic inputs. Never invoke getters, toJSON, or Error serialization.
export function redact(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === 'string') return sensitiveValue.test(value) ? REDACTED : value.slice(0, 512);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : REDACTED;
  if (typeof value !== 'object' || depth > 8 || value instanceof Error || Buffer.isBuffer(value)) return REDACTED;
  if (seen.has(value)) return REDACTED;
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 32).map(item => redact(item, seen, depth + 1));
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value)).slice(0, 64)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    result[key] = sensitiveKey.test(key) || !('value' in descriptor)
      ? REDACTED : redact(descriptor.value, seen, depth + 1);
  }
  return result;
}
