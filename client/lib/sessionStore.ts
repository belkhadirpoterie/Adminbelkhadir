import { Preferences } from "@capacitor/preferences";

const SESSION_KEY = "atelier_admin_session";

export async function setAuthToken(token: string) {
  await Preferences.set({ key: SESSION_KEY, value: token });
}

export async function getAuthToken() {
  const result = await Preferences.get({ key: SESSION_KEY });
  if (result.value) return result.value;

  if (typeof window !== "undefined") {
    const legacyToken = window.localStorage.getItem(SESSION_KEY);
    if (legacyToken) {
      await setAuthToken(legacyToken);
      window.localStorage.removeItem(SESSION_KEY);
      return legacyToken;
    }
  }

  return null;
}

export async function clearAuthToken() {
  await Preferences.remove({ key: SESSION_KEY });
  if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
}
