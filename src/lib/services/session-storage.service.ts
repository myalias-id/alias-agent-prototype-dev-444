const SESSION_ID_KEY = 'session_id';

export const sessionStorageService = {
  getSessionId: (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(SESSION_ID_KEY);
  },

  setSessionId: (id: string): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SESSION_ID_KEY, id);
  },
};
