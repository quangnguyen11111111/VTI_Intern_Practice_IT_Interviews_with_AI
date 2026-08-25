import { describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

describe('auth store', () => {
  it('keeps tokens out of state and clears user', () => {
    useAuthStore.getState().setUser({
      id: '1',
      email: 'a@example.com',
      fullName: 'A',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      createdAt: '',
    });
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().user).toBeNull();
    expect(Object.keys(useAuthStore.getState())).not.toContain('accessToken');
    expect(Object.keys(useAuthStore.getState())).not.toContain('refreshToken');
  });
});
