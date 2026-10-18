// src/api/authRefresh.ts
import { setAccessToken, clearTokensAndRedirect } from "./api";

const API_URL = process.env.REACT_APP_API_URL || "";

let refreshPromise: Promise<string | null> | null = null;

/**
 * Единый синглтон: если 5 запросов одновременно получили 401,
 * они все ждут разрешения одного и того же сетевого промиса.
 */
export const getSharedRefreshPromise = (): Promise<string | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error("Refresh token expired");
      }

      const data = await res.json();
      if (data?.access_token) {
        setAccessToken(data.access_token);
        return data.access_token;
      }
      return null;
    } catch {
      await clearTokensAndRedirect();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};