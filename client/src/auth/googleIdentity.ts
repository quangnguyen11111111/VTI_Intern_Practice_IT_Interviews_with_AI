const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisLoadPromise: Promise<typeof google.accounts.id> | null = null;

export const loadGoogleIdentityScript = (): Promise<typeof google.accounts.id> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not defined'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }

  if (gisLoadPromise) {
    return gisLoadPromise;
  }

  gisLoadPromise = new Promise<typeof google.accounts.id>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);

    const handleLoad = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
      } else {
        gisLoadPromise = null;
        reject(new Error('Google Identity Services SDK loaded but accounts.id is not defined'));
      }
    };

    const handleError = () => {
      gisLoadPromise = null;
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(new Error('Không thể tải thư viện Google Identity Services'));
    };

    if (script) {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
        return;
      }
      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      return;
    }

    script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return gisLoadPromise;
};

export const initializeGoogleIdentity = async (
  config: Omit<google.accounts.id.IdConfiguration, 'callback'> & {
    callback: (response: google.accounts.id.CredentialResponse) => void;
  }
): Promise<() => void> => {
  const gsi = await loadGoogleIdentityScript();
  let isCleanedUp = false;

  gsi.initialize({
    ...config,
    callback: (response) => {
      if (!isCleanedUp) {
        config.callback(response);
      }
    },
  });

  return () => {
    isCleanedUp = true;
    try {
      gsi.cancel();
    } catch {
      // Ignore if cancel fails
    }
  };
};

export const _resetGoogleIdentityLoader = (): void => {
  gisLoadPromise = null;
};
