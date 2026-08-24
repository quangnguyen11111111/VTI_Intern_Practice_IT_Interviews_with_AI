import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './schemas';
describe('auth schemas', () => {
  it('accepts backend-compatible credentials', () => expect(loginSchema.safeParse({ email: ' A@EXAMPLE.COM ', password: 'password' }).success).toBe(true));
  it('rejects passwords over 72 UTF-8 bytes', () => expect(loginSchema.safeParse({ email: 'a@example.com', password: 'é'.repeat(37) }).success).toBe(false));
  it('requires a full name for registration', () => expect(registerSchema.safeParse({ email: 'a@example.com', password: 'password' }).success).toBe(false));
});
