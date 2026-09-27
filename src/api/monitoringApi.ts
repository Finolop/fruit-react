import { getAuthHeaders } from "./api";

const API_URL = process.env.REACT_APP_API_URL || "";

export interface CameraItem {
  id: string;
  project_id: string;
  stream_url: string;
  is_active: boolean;
  created_at: string;
}

export interface CameraCreateRequest {
  stream_url: string;
}

export interface ApplyTemplateResponse {
  created_stages_count: number;
  status: string;
  message: string;
}

export interface EarlyCompletePayload {
  actual_end_date?: string;
  comment?: string;
}

const handleRes = async <T>(
  res: Response,
  defaultErrorMsg: string,
): Promise<T> => {
  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = json?.detail?.[0]?.msg || json?.detail || json?.message;
    } catch {
      // Игнорируем ошибку парсинга JSON
    }
    throw new Error(detail || `${defaultErrorMsg} (Код: ${res.status})`);
  }
  return res.json();
};

export const monitoringApi = {
  // 1. Получение списка камер объекта
  getCameras: async (projectId: string): Promise<CameraItem[]> => {
    const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/cameras`, {
      headers: getAuthHeaders(),
    });
    return handleRes<CameraItem[]>(res, "Не удалось загрузить камеры объекта");
  },

  // 2. Добавление RTSP-потока камеры (Прораб / Инженер / Админ)
  addCamera: async (
    projectId: string,
    streamUrl: string,
  ): Promise<CameraItem> => {
    const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/cameras`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ stream_url: streamUrl } as CameraCreateRequest),
    });
    return handleRes<CameraItem>(res, "Ошибка добавления камеры");
  },

  // 3. Отключение / включение камеры
  toggleCameraActive: async (
    cameraId: string,
    isActive: boolean,
  ): Promise<CameraItem> => {
    const res = await fetch(`${API_URL}/api/v1/cameras/${cameraId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ is_active: isActive }),
    });
    return handleRes<CameraItem>(res, "Ошибка обновления статуса камеры");
  },

  // 4. Удаление камеры
  deleteCamera: async (cameraId: string): Promise<{ message: string }> => {
    const res = await fetch(`${API_URL}/api/v1/cameras/${cameraId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleRes<{ message: string }>(res, "Не удалось удалить камеру");
  },

  // 5. Автогенерация графика из шаблона ТЗ по дате старта
  applyTemplate: async (
    projectId: string,
    startDate?: string,
  ): Promise<ApplyTemplateResponse> => {
    const payload = {
      start_date: startDate || new Date().toISOString(),
    };
    const res = await fetch(
      `${API_URL}/api/v1/projects/${projectId}/schedules/apply-template`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      },
    );
    return handleRes<ApplyTemplateResponse>(
      res,
      "Ошибка генерации графика из шаблона",
    );
  },

  // 6. Досрочное закрытие этапа инженером технадзора
  completeStageEarly: async (
    projectId: string,
    scheduleId: string,
    payload?: { actual_end_date?: string; comment?: string },
  ): Promise<any> => {
    const headers = getAuthHeaders();
    const body = JSON.stringify({
      actual_end_date: payload?.actual_end_date || new Date().toISOString(),
      foreman_comment:
        payload?.comment || "Завершено досрочно по акту АОСР технадзора",
    });

    const res = await fetch(
      `${API_URL}/api/v1/projects/${projectId}/schedules/${scheduleId}/complete-early`,
      {
        method: "POST",
        headers,
        body,
      },
    );

    return handleRes<any>(
      res,
      "Не удалось зафиксировать досрочное завершение этапа",
    );
  },
};
