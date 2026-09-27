const API_URL = process.env.REACT_APP_API_URL || "";

// ==========================================
// Типы данных мониторинга (Live Summary)
// ==========================================

export interface LiveSummaryResponse {
  project_id: string;
  alert_level: "GREEN" | "YELLOW" | "RED";
  special_status?: "ORANGE" | "PURPLE" | null;
  physical_progress_percent: number;
  time_elapsed_percent: number;
  current_stage?: {
    name: string;
    days_remaining: number;
  };
  equipment_realtime?: {
    active_count: number;
    idle_count: number;
  };
}

// ==========================================
// Утилиты работы с токенами и заголовками
// ==========================================

export const getAccessToken = (): string | null => {
  return localStorage.getItem("access_token") || localStorage.getItem("token");
};

export const setAccessToken = (token: string): void => {
  localStorage.setItem("access_token", token);
  localStorage.setItem("token", token);
};

export const clearTokensAndRedirect = async (): Promise<void> => {
  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Ошибка при вызове logout на сервере:", err);
  } finally {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user_data");
    window.location.href = "/auth";
  }
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

// ==========================================
// Очередь запросов при ротации токена
// ==========================================

let isRefreshing = false;
let refreshSubscribers: ((newToken: string) => void)[] = [];

const onTokenRefreshed = (newToken: string) => {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (newToken: string) => void) => {
  refreshSubscribers.push(callback);
};

export const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error("Не удалось обновить токен сессии");
    }

    const data = await res.json();
    if (data?.access_token) {
      setAccessToken(data.access_token);
      return data.access_token;
    }
    return null;
  } catch (err) {
    console.warn("Срок действия сессии истек, требуется повторная авторизация:", err);
    return null;
  }
};

// ==========================================
// Сетевой интерцептор
// ==========================================

export const fetchWithAuth = async (
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> => {
  const token = getAccessToken();
  const headers = new Headers(init.headers || {});

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;

      const newToken = await refreshAuthToken();
      isRefreshing = false;

      if (newToken) {
        onTokenRefreshed(newToken);
        headers.set("Authorization", `Bearer ${newToken}`);
        return fetch(input, {
          ...init,
          headers,
          credentials: "include",
        });
      } else {
        refreshSubscribers = [];
        await clearTokensAndRedirect();
        return response;
      }
    }

    return new Promise<Response>((resolve) => {
      addRefreshSubscriber(async (newToken: string) => {
        headers.set("Authorization", `Bearer ${newToken}`);
        const retryRes = await fetch(input, {
          ...init,
          headers,
          credentials: "include",
        });
        resolve(retryRes);
      });
    });
  }

  return response;
};

// ==========================================
// Запросы мониторинга и файлов
// ==========================================

export const uploadCameraFrame = async (cameraId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithAuth(
    `${API_URL}/api/v1/cameras/${cameraId}/frames/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Ошибка загрузки кадра на сервер");
  }

  return response.json();
};

export const getIntervalAnalytics = async (
  projectId: string,
  limit = 50,
  offset = 0
) => {
  const response = await fetchWithAuth(
    `${API_URL}/api/v1/projects/${projectId}/interval-analytics?limit=${limit}&offset=${offset}`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    throw new Error("Ошибка получения интервальной аналитики");
  }

  return response.json();
};

export const getProjectFrames = async (projectId: string, limit = 50) => {
  const response = await fetchWithAuth(
    `${API_URL}/api/v1/projects/${projectId}/frames?limit=${limit}`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    throw new Error("Ошибка получения кадров");
  }

  return response.json();
};

export const getLiveSummary = async (projectId: string): Promise<LiveSummaryResponse> => {
  const response = await fetchWithAuth(
    `${API_URL}/api/v1/projects/${projectId}/live-summary`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    throw new Error("Ошибка получения Live Summary");
  }

  return response.json();
};