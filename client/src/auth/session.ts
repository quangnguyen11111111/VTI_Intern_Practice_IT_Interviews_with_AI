const REFRESH_TOKEN_KEY = 'vti_ai_refresh_token';
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getRefreshToken = () => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setRefreshToken = (token: string | null) => {
  try {
    if (typeof window === 'undefined') return;
    if (token) window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    else window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // A blocked sessionStorage must degrade to a memory-only, non-persistent session.
  }
};

export const clearSession = () => {
  setAccessToken(null);
  setRefreshToken(null);
};
