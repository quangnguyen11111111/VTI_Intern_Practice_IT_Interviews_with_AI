import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetGoogleIdentityLoader,
  initializeGoogleIdentity,
  loadGoogleIdentityScript,
} from './googleIdentity';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

const createGsi = () =>
  ({
    initialize: vi.fn(),
    renderButton: vi.fn(),
    prompt: vi.fn(),
    cancel: vi.fn(),
  }) as unknown as typeof google.accounts.id;

const setGoogleIdentity = (gsi: typeof google.accounts.id) => {
  window.google = { accounts: { id: gsi } };
};

const removeGisScripts = () => {
  document.querySelectorAll(`script[src="${GIS_SRC}"]`).forEach((script) => script.remove());
};

describe('Google Identity Services loader', () => {
  beforeEach(() => {
    _resetGoogleIdentityLoader();
    Reflect.deleteProperty(window, 'google');
    removeGisScripts();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetGoogleIdentityLoader();
    Reflect.deleteProperty(window, 'google');
    removeGisScripts();
  });

  it('rejects clearly when called without a browser window', async () => {
    vi.stubGlobal('window', undefined);

    await expect(loadGoogleIdentityScript()).rejects.toThrow('Window is not defined');
  });

  it('returns the already-loaded GIS instance without injecting a script', async () => {
    const gsi = createGsi();
    setGoogleIdentity(gsi);

    await expect(loadGoogleIdentityScript()).resolves.toBe(gsi);
    expect(document.querySelector(`script[src="${GIS_SRC}"]`)).toBeNull();
  });

  it('deduplicates concurrent script loads and resolves after the script loads', async () => {
    const first = loadGoogleIdentityScript();
    const second = loadGoogleIdentityScript();
    const script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const gsi = createGsi();

    expect(first).toBe(second);
    expect(script).not.toBeNull();
    setGoogleIdentity(gsi);
    script?.dispatchEvent(new Event('load'));

    await expect(first).resolves.toBe(gsi);
  });

  it('uses an existing script and resolves when GIS becomes available during loading', async () => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    document.head.appendChild(script);
    const gsi = createGsi();

    const promise = loadGoogleIdentityScript();
    setGoogleIdentity(gsi);
    script.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBe(gsi);
  });

  it('handles an existing script that already exposes GIS during initialization', async () => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    document.head.appendChild(script);
    const gsi = createGsi();
    let reads = 0;

    Object.defineProperty(window, 'google', {
      configurable: true,
      get: () => {
        reads += 1;
        return reads === 1 ? undefined : { accounts: { id: gsi } };
      },
    });

    await expect(loadGoogleIdentityScript()).resolves.toBe(gsi);
  });

  it('removes a failed script and allows a later retry', async () => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    document.head.appendChild(script);

    const failed = loadGoogleIdentityScript();
    script.dispatchEvent(new Event('error'));

    await expect(failed).rejects.toThrow('Không thể tải thư viện Google Identity Services');
    expect(document.querySelector(`script[src="${GIS_SRC}"]`)).toBeNull();
  });

  it('rejects when the SDK loads without accounts.id', async () => {
    const promise = loadGoogleIdentityScript();
    const script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);

    Reflect.set(window, 'google', {});
    script?.dispatchEvent(new Event('load'));

    await expect(promise).rejects.toThrow('accounts.id is not defined');
  });

  it('forwards callbacks until cleanup and tolerates cancel failures', async () => {
    const gsi = createGsi();
    const callback = vi.fn();
    const initialized: { callback: (response: google.accounts.id.CredentialResponse) => void }[] = [];
    gsi.initialize = vi.fn((config) => initialized.push(config));
    gsi.cancel = vi.fn(() => {
      throw new Error('cancel failed');
    });
    setGoogleIdentity(gsi);

    const cleanup = await initializeGoogleIdentity({ client_id: 'client-id', callback });
    initialized[0].callback({ credential: 'google-id-token' });
    expect(callback).toHaveBeenCalledWith({ credential: 'google-id-token' });

    cleanup();
    initialized[0].callback({ credential: 'ignored-after-cleanup' });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(gsi.cancel).toHaveBeenCalledTimes(1);
  });
});
