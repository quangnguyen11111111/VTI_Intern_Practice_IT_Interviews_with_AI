import type { Role } from './types';
export const roleLanding = (role: Role) => role === 'ADMIN' ? '/' : '/setup';
export const canAccess = (role: Role | undefined, allowed: Role[]) => !!role && allowed.includes(role);
