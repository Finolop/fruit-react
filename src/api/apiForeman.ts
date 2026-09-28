// src/api/apiForeman.ts

import { fetchWithAuth } from "./api";
import {
  ScheduleStageItem,
  StageSyncPayload,
  ApplyTemplateResponse,
  CurrentRequirementsResponse,
} from "../types/foreman";
import { ProjectData } from "../pages/foreman/ForemanPage";

const handleApiResponse = async <T>(
  res: Response,
  defaultErrorMsg: string,
): Promise<T> => {
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      if (typeof errJson?.detail === "string") {
        detail = errJson.detail;
      } else if (Array.isArray(errJson?.detail)) {
        detail = errJson.detail.map((e: any) => e.msg || e.message).join(", ");
      } else if (errJson?.message) {
        detail = errJson.message;
      }
    } catch {}
    throw new Error(detail || `${defaultErrorMsg} (Код: ${res.status})`);
  }
  return res.json();
};

export const foremanApi = {
  // 1. Паспорт конкретного ОКС (GET /projects/{project_id})
  getProject: async (projectId: string): Promise<ProjectData> => {
    const res = await fetchWithAuth(`/api/v1/projects/${projectId}`);
    return handleApiResponse<ProjectData>(
      res,
      "Не удалось загрузить данные ОКС",
    );
  },

  // 2. Дерево этапов графика (GET /projects/{project_id}/schedules)
  getSchedules: async (projectId: string): Promise<ScheduleStageItem[]> => {
    const res = await fetchWithAuth(`/api/v1/projects/${projectId}/schedules`);
    return handleApiResponse<ScheduleStageItem[]>(
      res,
      "Не удалось загрузить дерево этапов",
    );
  },

  // 3. Автогенерация графика из шаблона ТЗ (POST /apply-template)
  applyTemplate: async (
    projectId: string,
    startDate?: string,
  ): Promise<ApplyTemplateResponse> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/schedules/apply-template`,
      {
        method: "POST",
        body: JSON.stringify({
          start_date: startDate || new Date().toISOString(),
        }),
      },
    );
    return handleApiResponse<ApplyTemplateResponse>(
      res,
      "Ошибка генерации графика из шаблона ТЗ",
    );
  },

  // 4. Пакетное сохранение правок Ганта (PUT /bulk-sync)
  bulkSync: async (
    projectId: string,
    stages: StageSyncPayload[],
  ): Promise<{ message: string }> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/schedules/bulk-sync`,
      {
        method: "PUT",
        body: JSON.stringify({ stages }),
      },
    );
    return handleApiResponse<{ message: string }>(
      res,
      "Ошибка пакетного сохранения графика",
    );
  },

  // 5. Утверждение графика DRAFT -> ACTIVE (POST /confirm)
  confirmSchedule: async (projectId: string): Promise<{ message: string }> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/schedules/confirm`,
      {
        method: "POST",
      },
    );
    return handleApiResponse<{ message: string }>(
      res,
      "Не удалось утвердить график",
    );
  },

  // 6. Ручной старт этапа (POST /schedules/{schedule_id}/start)
  startStage: async (
    projectId: string,
    scheduleId: string,
  ): Promise<ScheduleStageItem> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/schedules/${scheduleId}/start`,
      {
        method: "POST",
      },
    );
    return handleApiResponse<ScheduleStageItem>(
      res,
      "Не удалось запустить этап в работу",
    );
  },

  // 7. Досрочное завершение этапа по акту АОСР (POST /complete-early)
  completeStageEarly: async (
    projectId: string,
    scheduleId: string,
    actualEndDate?: string,
    foremanComment?: string,
  ): Promise<ScheduleStageItem> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/schedules/${scheduleId}/complete-early`,
      {
        method: "POST",
        body: JSON.stringify({
          actual_end_date: actualEndDate || new Date().toISOString(),
          foreman_comment:
            foremanComment || "Завершено досрочно по акту АОСР технадзора",
        }),
      },
    );
    return handleApiResponse<ScheduleStageItem>(
      res,
      "Не удалось зафиксировать досрочное завершение этапа",
    );
  },

  // 8. Текущие требования по технике для ML-воркера
  getCurrentRequirements: async (
    projectId: string,
  ): Promise<CurrentRequirementsResponse> => {
    const res = await fetchWithAuth(
      `/api/v1/projects/${projectId}/schedules/current-requirements`,
    );
    return handleApiResponse<CurrentRequirementsResponse>(
      res,
      "Не удалось получить текущие требования по технике",
    );
  },
};
